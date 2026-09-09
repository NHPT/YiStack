#!/usr/bin/env bash

set -Eeuo pipefail

PACKAGE_ROOT="${YISTACK_PACKAGE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
INSTALL_ROOT="${YISTACK_INSTALL_ROOT:-/opt/yistack}"
CONFIG_DIR="${YISTACK_CONFIG_DIR:-/etc/yistack}"
DATA_DIR="${YISTACK_DATA_DIR:-/var/lib/yistack}"
SYSTEMD_DIR="${YISTACK_SYSTEMD_DIR:-/etc/systemd/system}"
CONFIG_FILE="${YISTACK_ENV_FILE:-$CONFIG_DIR/yistack.env}"
POSTGRES_CONFIG_FILE="${YISTACK_POSTGRES_ENV_FILE:-$CONFIG_DIR/postgres.env}"
BACKUP_DIR="${YISTACK_DATABASE_BACKUP_DIR:-$DATA_DIR/database-backups}"
SERVICE_USER="${YISTACK_SERVICE_USER:-yistack}"
SERVICE_GROUP="${YISTACK_SERVICE_GROUP:-yistack}"
SYSTEMCTL_BIN="${YISTACK_SYSTEMCTL_BIN:-systemctl}"
RUNUSER_BIN="${YISTACK_RUNUSER_BIN:-runuser}"
INSTALLER_PATH="${YISTACK_INSTALLER_PATH:-$PACKAGE_ROOT/install.sh}"
LOCK_FILE="${YISTACK_UPGRADE_LOCK_FILE:-/run/lock/yistack-upgrade.lock}"
SKIP_ROOT_CHECK="${YISTACK_SKIP_ROOT_CHECK:-false}"
HEALTH_ATTEMPTS="${YISTACK_UPGRADE_HEALTH_ATTEMPTS:-60}"
HEALTH_SLEEP_SECONDS="${YISTACK_UPGRADE_HEALTH_SLEEP_SECONDS:-1}"
INSTALL_BROWSER=true

upgrade_active=false
install_attempted=false
database_mutation_attempted=false
backup_created=false
target_was_active=false
target_was_enabled=false
backend_was_active=false
frontend_was_active=false
browser_worker_was_active=false
ephemeral_reset_timer_was_active=false
ephemeral_cleanup_timer_was_active=false
application_was_active=false
unit_backup_dir=""
recovery_succeeded=true
current_release=""
current_version=""
target_version=""
backup_name=""
backup_path=""
config_backup_path=""
backup_helper_path=""

usage() {
  cat <<'EOF'
Internal Release upgrade entrypoint.
Use: sudo yistackctl upgrade <release-directory|release.tar.gz> [options]

Options:
  --skip-browser-install  Keep the existing Playwright Chromium runtime
  --help                  Show this help

The command verifies the new Release, stops YiStack, creates a database backup,
installs and migrates the Release, verifies the database, and restores the
previous Release and database if the upgrade fails.
EOF
}

die() {
  echo "YiStack upgrade failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

read_version() {
  local version_file="$1"
  [ -r "$version_file" ] || die "version file is missing: $version_file"
  tr -d '[:space:]' < "$version_file"
}

validate_version() {
  [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    die "invalid Release version: $1"
}

run_database_command() {
  local release_root="$1"
  local command="$2"
  (
    set -a
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    set +a
    YISTACK_SKIP_DOTENV=true \
    YISTACK_INSTALL_DIR="$release_root" \
    YISTACK_MIGRATIONS_DIR="$release_root/database/migrations" \
      "$release_root/bin/yistack-server" database "$command"
  )
}

run_backup_command() {
  local command="$1"
  "$RUNUSER_BIN" -u "$SERVICE_USER" -- env \
    HOME="$DATA_DIR" \
    XDG_RUNTIME_DIR="/run/user/$(id -u "$SERVICE_USER")" \
    YISTACK_ENV_FILE="$CONFIG_FILE" \
    YISTACK_POSTGRES_ENV_FILE="$POSTGRES_CONFIG_FILE" \
    YISTACK_DATABASE_BACKUP_DIR="$BACKUP_DIR" \
    "$backup_helper_path" "$command" "$backup_name"
}

stage_backup_helper() {
  backup_helper_path="$BACKUP_DIR/.yistack-database-backup.upgrade.$$"
  install -m 0700 -o "$SERVICE_USER" -g "$SERVICE_GROUP" \
    "$PACKAGE_ROOT/bin/yistack-database-backup" "$backup_helper_path"
}

cleanup_backup_helper() {
  if [ -n "$backup_helper_path" ]; then
    rm -f "$backup_helper_path" || return 1
  fi
  backup_helper_path=""
}

cleanup_historical_releases() {
  local releases_dir="$INSTALL_ROOT/releases"
  local active_release=""
  local candidate=""
  local candidate_name=""
  local highest_version=""
  local resolved_candidate=""

  active_release="$(realpath "$INSTALL_ROOT/current")" || return 1
  [ "$active_release" = "$releases_dir/$target_version" ] || return 1
  while IFS= read -r candidate; do
    candidate_name="$(basename "$candidate")"
    [[ "$candidate_name" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    [ ! -L "$candidate" ] || return 1
    resolved_candidate="$(realpath "$candidate")" || return 1
    case "$resolved_candidate" in
      "$releases_dir"/*)
        ;;
      *)
        return 1
        ;;
    esac
    [ "$resolved_candidate" != "$active_release" ] || continue
    highest_version="$(printf '%s\n%s\n' "$candidate_name" "$target_version" |
      sort -V | tail -n 1)"
    [ "$highest_version" = "$target_version" ] || continue
    rm -rf --one-file-system -- "$resolved_candidate" || return 1
  done < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -name 'v*.*.*' -print)
}

snapshot_systemd_units() {
  local source_dir unit unit_name
  unit_backup_dir="${backup_path%.dump}.systemd"
  install -d -m 0700 "$unit_backup_dir/files"
  : > "$unit_backup_dir/units.list"
  : > "$unit_backup_dir/units.state"

  for source_dir in "$current_release/systemd" "$PACKAGE_ROOT/systemd"; do
    [ -d "$source_dir" ] || continue
    for unit in "$source_dir"/*; do
      [ -f "$unit" ] || continue
      unit_name="$(basename "$unit")"
      case "$unit_name" in
        yistack-*.service | yistack-*.timer | yistack.target)
          ;;
        *)
          die "unexpected YiStack systemd unit name: $unit_name"
          ;;
      esac
      if grep -Fqx "$unit_name" "$unit_backup_dir/units.list"; then
        continue
      fi
      printf '%s\n' "$unit_name" >> "$unit_backup_dir/units.list"
      if [ -e "$SYSTEMD_DIR/$unit_name" ] || [ -L "$SYSTEMD_DIR/$unit_name" ]; then
        cp -a "$SYSTEMD_DIR/$unit_name" "$unit_backup_dir/files/$unit_name"
        printf 'present %s\n' "$unit_name" >> "$unit_backup_dir/units.state"
      else
        printf 'absent %s\n' "$unit_name" >> "$unit_backup_dir/units.state"
      fi
    done
  done
}

restore_previous_release_files() {
  local state unit_name
  [ -d "$current_release" ] || return 1
  [ -s "$unit_backup_dir/units.state" ] || return 1

  ln -sfn "$current_release" "$INSTALL_ROOT/current.recovery" || return 1
  mv -Tf "$INSTALL_ROOT/current.recovery" "$INSTALL_ROOT/current" || return 1
  while read -r state unit_name; do
    rm -f "$SYSTEMD_DIR/$unit_name" || return 1
    if [ "$state" = "present" ]; then
      cp -a "$unit_backup_dir/files/$unit_name" "$SYSTEMD_DIR/$unit_name" || return 1
    elif [ "$state" != "absent" ]; then
      return 1
    fi
  done < "$unit_backup_dir/units.state"
  "$SYSTEMCTL_BIN" daemon-reload || return 1
}

unit_is_active() {
  "$SYSTEMCTL_BIN" is-active --quiet "$1"
}

stop_managed_unit() {
  local unit="$1"
  if unit_is_active "$unit"; then
    "$SYSTEMCTL_BIN" stop "$unit"
  fi
  ! unit_is_active "$unit"
}

unit_is_enabled() {
  "$SYSTEMCTL_BIN" is-enabled --quiet "$1"
}

restore_target_enablement() {
  if [ "$target_was_enabled" = "true" ]; then
    "$SYSTEMCTL_BIN" enable yistack.target || return 1
  else
    "$SYSTEMCTL_BIN" disable yistack.target || return 1
  fi
}

restore_application_state() {
  if [ "$target_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack.target || return 1
    return 0
  fi
  if [ "$backend_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack-backend.service || return 1
  fi
  if [ "$frontend_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack-frontend.service || return 1
  fi
  if [ "$browser_worker_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack-browser-worker.service || return 1
  fi
}

restore_ephemeral_timer_state() {
  if [ "$ephemeral_reset_timer_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack-ephemeral-reset.timer || return 1
  fi
  if [ "$ephemeral_cleanup_timer_was_active" = "true" ]; then
    "$SYSTEMCTL_BIN" start yistack-ephemeral-cleanup.timer || return 1
  fi
}

stop_upgrade_writers() {
  local unit
  for unit in \
    yistack-ephemeral-reset.timer \
    yistack-ephemeral-cleanup.timer \
    yistack-ephemeral-reset.service \
    yistack-ephemeral-cleanup.service \
    yistack.target \
    yistack-backend.service \
    yistack-frontend.service \
    yistack-browser-worker.service; do
    stop_managed_unit "$unit" || return 1
  done
}

recover_failed_upgrade() {
  local exit_code="$?"
  local restored_backup=""
  if [ "$exit_code" -eq 0 ] || [ "$upgrade_active" != "true" ]; then
    return "$exit_code"
  fi

  trap - EXIT
  set +e
  echo "Upgrade failed; restoring the previous YiStack state." >&2
  stop_upgrade_writers >/dev/null 2>&1 || recovery_succeeded=false

  if [ -n "$config_backup_path" ] && [ -f "$config_backup_path" ]; then
    cp -a "$config_backup_path" "$CONFIG_FILE" || recovery_succeeded=false
  fi
  if [ "$database_mutation_attempted" = "true" ] &&
    [ "$backup_created" = "true" ]; then
    restored_backup="$(run_backup_command restore)" || recovery_succeeded=false
    if [ -n "$restored_backup" ] && [ "$recovery_succeeded" = "true" ]; then
      echo "Database restored from $restored_backup" >&2
    fi
  fi
  if [ "$install_attempted" = "true" ]; then
    restore_previous_release_files || recovery_succeeded=false
  fi
  if [ "$install_attempted" = "true" ]; then
    restore_target_enablement || recovery_succeeded=false
  fi

  if [ "$recovery_succeeded" = "true" ] &&
    [ "$application_was_active" = "true" ]; then
    restore_application_state || recovery_succeeded=false
    if [ "$recovery_succeeded" = "true" ] &&
      { [ "$target_was_active" = "true" ] ||
        { [ "$backend_was_active" = "true" ] && [ "$frontend_was_active" = "true" ]; }; }; then
      wait_for_health || recovery_succeeded=false
    fi
  fi
  if [ "$recovery_succeeded" = "true" ]; then
    restore_ephemeral_timer_state || recovery_succeeded=false
  fi
  cleanup_backup_helper || recovery_succeeded=false

  if [ "$recovery_succeeded" = "true" ]; then
    echo "Previous Release $current_version restored." >&2
    if [ "$backup_created" = "true" ]; then
      echo "Database backup retained at $backup_path" >&2
    fi
  else
    stop_upgrade_writers >/dev/null 2>&1 || true
    echo "Automatic recovery was incomplete. YiStack remains stopped." >&2
    if [ "$backup_created" = "true" ]; then
      echo "Verified database backup: $backup_path" >&2
    else
      echo "No database backup was created before the failure." >&2
    fi
  fi
  exit "$exit_code"
}

wait_for_health() {
  for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if "$INSTALL_ROOT/current/bin/yistackctl" health >/dev/null 2>&1; then
      return 0
    fi
    sleep "$HEALTH_SLEEP_SECONDS"
  done
  echo "YiStack health check did not pass after the upgrade." >&2
  return 1
}

main() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --skip-browser-install)
        INSTALL_BROWSER=false
        ;;
      --help)
        usage
        return 0
        ;;
      *)
        usage >&2
        die "unknown option: $1"
        ;;
    esac
    shift
  done

  if [ "$SKIP_ROOT_CHECK" != "true" ] && [ "$(id -u)" -ne 0 ]; then
    die "the upgrade command must run as root"
  fi
  for command in basename cp date diff dirname find flock grep id install ln mkdir mv realpath rm sed seq sha256sum sleep sort tail tr; do
    require_command "$command"
  done
  [[ "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] ||
    die "YISTACK_UPGRADE_HEALTH_ATTEMPTS must be a positive integer"
  [[ "$HEALTH_SLEEP_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]] ||
    die "YISTACK_UPGRADE_HEALTH_SLEEP_SECONDS must be a non-negative number"
  [ -f "$PACKAGE_ROOT/MANIFEST.sha256" ] ||
    die "Release manifest is missing from $PACKAGE_ROOT"
  [ -x "$INSTALLER_PATH" ] ||
    die "Release installer is missing: $INSTALLER_PATH"
  [ -x "$PACKAGE_ROOT/bin/yistack-database-backup" ] ||
    die "database backup helper is missing from $PACKAGE_ROOT"
  [ -x "$PACKAGE_ROOT/bin/yistack-server" ] ||
    die "database migration binary is missing from $PACKAGE_ROOT"
  if ! diff -u \
    <(cd "$PACKAGE_ROOT" && find . -type f ! -name MANIFEST.sha256 -print | LC_ALL=C sort) \
    <(sed -nE 's/^[0-9a-f]{64}  (\.\/.*)$/\1/p' "$PACKAGE_ROOT/MANIFEST.sha256" |
      LC_ALL=C sort) >/dev/null; then
    die "Release package file inventory does not match MANIFEST.sha256"
  fi

  [ -r "$CONFIG_FILE" ] || die "existing YiStack configuration is missing: $CONFIG_FILE"
  [ -e "$INSTALL_ROOT/current" ] ||
    die "existing YiStack installation is missing: $INSTALL_ROOT/current"

  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "another YiStack upgrade is running"

  (
    cd "$PACKAGE_ROOT"
    sha256sum --check --quiet MANIFEST.sha256
  ) || die "Release package checksum verification failed"

  current_release="$(realpath "$INSTALL_ROOT/current")"
  case "$current_release" in
    "$INSTALL_ROOT"/releases/*)
      ;;
    *)
      die "current Release is outside $INSTALL_ROOT/releases: $current_release"
      ;;
  esac
  current_version="$(read_version "$current_release/VERSION")"
  target_version="$(read_version "$PACKAGE_ROOT/VERSION")"
  validate_version "$current_version"
  validate_version "$target_version"
  [ "$current_version" != "$target_version" ] ||
    die "YiStack $target_version is already installed"
  highest_version="$(printf '%s\n%s\n' "$current_version" "$target_version" |
    sort -V | tail -n 1)"
  [ "$highest_version" = "$target_version" ] ||
    die "downgrades are not supported: $current_version -> $target_version"

  echo "Preflighting database compatibility for $current_version -> $target_version..."
  run_database_command "$PACKAGE_ROOT" plan >/dev/null

  if unit_is_enabled yistack.target; then
    target_was_enabled=true
  fi
  if unit_is_active yistack.target; then
    target_was_active=true
  fi
  if unit_is_active yistack-backend.service; then
    backend_was_active=true
  fi
  if unit_is_active yistack-frontend.service; then
    frontend_was_active=true
  fi
  if unit_is_active yistack-browser-worker.service; then
    browser_worker_was_active=true
  fi
  if [ "$target_was_active" = "true" ] ||
    [ "$backend_was_active" = "true" ] ||
    [ "$frontend_was_active" = "true" ] ||
    [ "$browser_worker_was_active" = "true" ]; then
    application_was_active=true
  fi
  if unit_is_active yistack-ephemeral-reset.timer; then
    ephemeral_reset_timer_was_active=true
  fi
  if unit_is_active yistack-ephemeral-cleanup.timer; then
    ephemeral_cleanup_timer_was_active=true
  fi

  upgrade_active=true
  trap recover_failed_upgrade EXIT
  stop_upgrade_writers || die "unable to stop all YiStack database writers"

  install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$BACKUP_DIR"
  stage_backup_helper
  backup_name="upgrade-${current_version}-to-${target_version}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  backup_path="$(run_backup_command create)"
  backup_created=true
  config_backup_path="${backup_path%.dump}.yistack.env"
  cp -a "$CONFIG_FILE" "$config_backup_path"
  snapshot_systemd_units
  echo "Verified database backup: $backup_path"

  install_args=()
  if [ "$INSTALL_BROWSER" != "true" ]; then
    install_args+=(--skip-browser-install)
  fi
  install_attempted=true
  "$INSTALLER_PATH" "${install_args[@]}"
  restore_target_enablement

  run_database_command "$INSTALL_ROOT/current" plan >/dev/null
  database_mutation_attempted=true
  run_database_command "$INSTALL_ROOT/current" migrate >/dev/null
  run_database_command "$INSTALL_ROOT/current" verify >/dev/null

  restore_application_state
  if [ "$target_was_active" = "true" ] ||
    { [ "$backend_was_active" = "true" ] && [ "$frontend_was_active" = "true" ]; }; then
    wait_for_health
  fi
  restore_ephemeral_timer_state

  if ! cleanup_backup_helper; then
    echo "Warning: unable to remove temporary database backup helper: $backup_helper_path" >&2
  fi
  upgrade_active=false
  trap - EXIT
  if ! cleanup_historical_releases; then
    echo "Warning: upgrade succeeded, but one or more historical Release directories could not be removed." >&2
  fi
  echo "YiStack upgraded from $current_version to $target_version."
  echo "Database backup retained at $backup_path"
  if [ "$application_was_active" != "true" ]; then
    echo "YiStack was stopped before the upgrade and remains stopped."
  fi
}

main "$@"
