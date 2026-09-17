#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_HELPER="${1:-$ROOT_DIR/deploy/bin/yistack-postgres}"
[ -x "$POSTGRES_HELPER" ] || {
  echo "PostgreSQL helper is missing or not executable: $POSTGRES_HELPER" >&2
  exit 1
}

root="$(mktemp -d "${TMPDIR:-/tmp}/yistack-postgres-image.XXXXXX")"
trap 'rm -rf "$root"' EXIT
mock_bin="$root/bin"
state_dir="$root/state"
postgres_env="$root/postgres.env"
podman_log="$root/podman.log"
mkdir -p "$mock_bin" "$state_dir" "$root/postgres-data"

cat > "$mock_bin/podman" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${MOCK_PODMAN_LOG:?}"
state_dir="${MOCK_PODMAN_STATE_DIR:?}"

image_id_for() {
  local image="$1"
  awk -F '\t' -v image="$image" '$1 == image { print $2; exit }' \
    "$state_dir/images" 2>/dev/null
}

case "${1:-} ${2:-}" in
  "container exists")
    [ -f "$state_dir/container-exists" ]
    ;;
  "image exists")
    [ -n "$(image_id_for "${3:-}")" ]
    ;;
  "image inspect")
    image_id_for "${!#}"
    ;;
  "images --format")
    [ "${MOCK_IMAGES_FAIL:-false}" != true ] || exit 125
    cut -f 1 "$state_dir/images"
    ;;
  "inspect --format")
    case "${3:-}" in
      *'.Config.Labels'*)
        cat "$state_dir/container-role"
        ;;
      *'.Mounts'*)
        cat "$state_dir/container-data-dir"
        ;;
      *'.ImageName'*)
        cat "$state_dir/container-image-name"
        ;;
      *'.Image}'*)
        cat "$state_dir/container-image-id"
        ;;
      *'.HostConfig.LogConfig.Type'*)
        printf 'k8s-file\n'
        ;;
      *'.State.Running'*)
        if [ -f "$state_dir/container-running" ]; then
          printf 'true\n'
        else
          printf 'false\n'
        fi
        ;;
      *)
        echo "Unexpected mock inspect format: ${3:-}" >&2
        exit 2
        ;;
    esac
    ;;
  "pull "*)
    printf '%s\t%s\n' "${2:-}" pulled-image-id >> "$state_dir/images"
    printf 'pulled-image-id\n'
    ;;
  "create --pull=never")
    image="${!#}"
    image_id="$(image_id_for "$image")"
    [ -n "$image_id" ] || {
      echo "Mock create received an unavailable image: $image" >&2
      exit 1
    }
    touch "$state_dir/container-exists"
    printf 'database\n' > "$state_dir/container-role"
    printf '%s\n' "${MOCK_POSTGRES_DATA_DIR:?}" > "$state_dir/container-data-dir"
    printf '%s\n' "$image" > "$state_dir/container-image-name"
    printf '%s\n' "$image_id" > "$state_dir/container-image-id"
    ;;
  "start "*)
    touch "$state_dir/container-running"
    ;;
  "exec "*)
    ;;
  *)
    echo "Unexpected mock podman command: $*" >&2
    exit 2
    ;;
esac
EOF
chmod 0755 "$mock_bin/podman"

target_image="docker.io/library/postgres:16-alpine"
alternate_image="registry.example.test/library/postgres:16-alpine"
second_alternate_image="mirror.example.test/postgres:16-alpine"
printf '%s\n' \
  "POSTGRES_IMAGE=$target_image" \
  'POSTGRES_CONTAINER_NAME=yistack-postgres-image-test' \
  'POSTGRES_USER=postgres' \
  'POSTGRES_PASSWORD=postgres-image-test-password' \
  'POSTGRES_DB=yistack' \
  'POSTGRES_PORT=55432' \
  "POSTGRES_DATA_DIR=$root/postgres-data" \
  'POSTGRES_LOG_DRIVER=k8s-file' > "$postgres_env"

run_postgres() {
  PATH="$mock_bin:$PATH" \
  MOCK_PODMAN_LOG="$podman_log" \
  MOCK_PODMAN_STATE_DIR="$state_dir" \
  MOCK_POSTGRES_DATA_DIR="$root/postgres-data" \
  YISTACK_POSTGRES_ENV_FILE="$postgres_env" \
    "$POSTGRES_HELPER" "$@"
}

reset_state() {
  rm -rf "$state_dir"
  mkdir -p "$state_dir"
  : > "$state_dir/images"
  : > "$podman_log"
}

add_image() {
  printf '%s\t%s\n' "$1" "$2" >> "$state_dir/images"
}

set_container() {
  touch "$state_dir/container-exists"
  printf 'database\n' > "$state_dir/container-role"
  printf '%s\n' "$root/postgres-data" > "$state_dir/container-data-dir"
  printf '%s\n' "$1" > "$state_dir/container-image-name"
  printf '%s\n' "$2" > "$state_dir/container-image-id"
}

reset_state
add_image "$target_image" cached-image-id
add_image "$alternate_image" alternate-image-id
resolved_image="$(run_postgres resolve-image)"
[ "$resolved_image" = "$target_image" ]

reset_state
add_image "$alternate_image" alternate-image-id
resolved_image="$(run_postgres resolve-image 2> "$root/single-candidate.err")"
[ "$resolved_image" = "$alternate_image" ]
grep -Fq 'Reusing the only local PostgreSQL image matching postgres:16-alpine' \
  "$root/single-candidate.err"

reset_state
if MOCK_IMAGES_FAIL=true run_postgres resolve-image > "$root/image-list-failure.out" 2>&1; then
  echo "PostgreSQL image resolution ignored a local image query failure." >&2
  exit 1
fi

reset_state
add_image "$alternate_image" alternate-image-id
add_image "$second_alternate_image" second-alternate-image-id
if run_postgres resolve-image </dev/null > "$root/multiple.out" 2>&1; then
  echo "PostgreSQL image resolution accepted ambiguous non-interactive input." >&2
  exit 1
fi
grep -Fq 'Multiple local PostgreSQL images match postgres:16-alpine' \
  "$root/multiple.out"
grep -Fq 'rerun with --postgres-image IMAGE' "$root/multiple.out"
resolved_image="$(
  run_postgres resolve-image "$second_alternate_image" \
    2> "$root/selected-candidate.err"
)"
[ "$resolved_image" = "$second_alternate_image" ]
grep -Fq "$alternate_image" "$root/selected-candidate.err"
grep -Fq "$second_alternate_image" "$root/selected-candidate.err"

reset_state
add_image "$alternate_image" alternate-image-id
run_postgres prepare-image > "$root/different-reference.out"
grep -Fq "pull $target_image" "$podman_log"
grep -Fq "Pulling PostgreSQL image: $target_image" \
  "$root/different-reference.out"

reset_state
add_image "$target_image" cached-image-id
run_postgres prepare-image > "$root/cached.out"
grep -Fq "Reusing local PostgreSQL image: $target_image" "$root/cached.out"
! grep -Fq 'pull ' "$podman_log"

reset_state
run_postgres start > "$root/missing.out"
grep -Fq "pull $target_image" "$podman_log"
grep -Fq 'create --pull=never' "$podman_log"

reset_state
set_container "$target_image" existing-image-id
run_postgres prepare-image > "$root/existing.out"
grep -Fq 'Reusing existing PostgreSQL container' "$root/existing.out"
! grep -Fq 'image inspect' "$podman_log"
! grep -Fq 'pull ' "$podman_log"

reset_state
set_container "$alternate_image" shared-image-id
add_image "$target_image" shared-image-id
run_postgres prepare-image > "$root/shared-id.out"
grep -Fq "image inspect --format {{.Id}} $target_image" "$podman_log"
! grep -Fq 'pull ' "$podman_log"

reset_state
set_container "$alternate_image" existing-image-id
add_image "$target_image" configured-image-id
if run_postgres prepare-image > "$root/mismatch.out" 2>&1; then
  echo "PostgreSQL image preflight accepted a different existing container image." >&2
  exit 1
fi
grep -Fq 'Refusing to replace the database container with a different image automatically.' \
  "$root/mismatch.out"
! grep -Eq '^(pull|create|rm|stop) ' "$podman_log"

echo "Release PostgreSQL image preflight validation passed."
