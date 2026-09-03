package handler

import (
	"bytes"
	"fmt"
	"html"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	previewVisualEditQuery       = "__yistack_visual_edit"
	previewVisualEditBridgeQuery = "__yistack_visual_edit_bridge"
	previewVisualEditMaxHTMLSize = 2 * 1024 * 1024
)

func previewVisualEditRequested(r *http.Request) bool {
	return r != nil && r.URL != nil && strings.TrimSpace(r.URL.Query().Get(previewVisualEditQuery)) == "1"
}

func previewVisualEditBridgeRequested(r *http.Request) bool {
	return r != nil && r.URL != nil && strings.TrimSpace(r.URL.Query().Get(previewVisualEditBridgeQuery)) == "1"
}

func stripPreviewVisualEditQuery(r *http.Request) {
	if r == nil || r.URL == nil {
		return
	}
	query := r.URL.Query()
	query.Del("project")
	query.Del(previewVisualEditQuery)
	query.Del(previewVisualEditBridgeQuery)
	r.URL.RawQuery = query.Encode()
}

func previewVisualEditBridgeURL(requestPath, projectID string) string {
	requestPath = strings.TrimSpace(requestPath)
	if requestPath == "" || !strings.HasPrefix(requestPath, "/") {
		requestPath = "/"
	}
	bridgeURL := &url.URL{Path: requestPath}
	query := bridgeURL.Query()
	projectID = strings.TrimSpace(projectID)
	if projectID != "" {
		query.Set("project", projectID)
	}
	query.Set(previewVisualEditBridgeQuery, "1")
	bridgeURL.RawQuery = query.Encode()
	return bridgeURL.String()
}

func servePreviewVisualEditBridge(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store, max-age=0")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, previewVisualEditBridgeScript)
}

func injectPreviewVisualEditBridge(resp *http.Response, requestPath, projectID string) error {
	if resp == nil || resp.Body == nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	mediaType, _, mediaTypeErr := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if mediaTypeErr != nil || !strings.EqualFold(mediaType, "text/html") {
		return nil
	}
	if strings.TrimSpace(resp.Header.Get("Content-Encoding")) != "" {
		return nil
	}
	if resp.ContentLength > previewVisualEditMaxHTMLSize {
		return nil
	}

	originalBody := resp.Body
	body, err := io.ReadAll(io.LimitReader(originalBody, previewVisualEditMaxHTMLSize+1))
	if err != nil {
		return fmt.Errorf("read preview html for visual edit bridge: %w", err)
	}
	if len(body) > previewVisualEditMaxHTMLSize {
		resp.Body = struct {
			io.Reader
			io.Closer
		}{Reader: io.MultiReader(bytes.NewReader(body), originalBody), Closer: originalBody}
		return nil
	}
	_ = originalBody.Close()

	bridgeTag := []byte(`<script src="` + html.EscapeString(previewVisualEditBridgeURL(requestPath, projectID)) + `" data-yistack-visual-edit="visual_edit.v1"></script>`)
	lowerBody := bytes.ToLower(body)
	insertAt := bytes.LastIndex(lowerBody, []byte("</body>"))
	if insertAt < 0 {
		insertAt = bytes.LastIndex(lowerBody, []byte("</head>"))
	}
	if insertAt < 0 {
		insertAt = len(body)
	}
	updated := make([]byte, 0, len(body)+len(bridgeTag))
	updated = append(updated, body[:insertAt]...)
	updated = append(updated, bridgeTag...)
	updated = append(updated, body[insertAt:]...)

	resp.Body = io.NopCloser(bytes.NewReader(updated))
	resp.ContentLength = int64(len(updated))
	resp.Header.Set("Content-Length", strconv.Itoa(len(updated)))
	resp.Header.Set("Cache-Control", "no-store, max-age=0")
	resp.Header.Del("ETag")
	return nil
}

const previewVisualEditBridgeScript = `(function () {
  'use strict';
  var schema = 'visual_edit.v1';
  var script = document.currentScript;
  if (!script || script.getAttribute('data-yistack-visual-edit') !== schema || window.parent === window) return;

  var parentOrigin = '';
  try { parentOrigin = new URL(document.referrer).origin; } catch (_) { return; }
  if (!/^https?:\/\//.test(parentOrigin)) return;

  var enabled = true;
  var overlay = null;
  var hovered = null;
  var styleProperties = [
    'background-color', 'border-color', 'border-radius', 'border-style',
    'border-width', 'color', 'display', 'font-family', 'font-size',
    'font-weight', 'gap', 'height', 'justify-content', 'line-height',
    'margin', 'padding', 'position', 'text-align', 'width'
  ];

  function safeText(value, maxLength) {
    return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maxLength);
  }

  function safeToken(value, maxLength) {
    var normalized = safeText(value, maxLength);
    return /^[A-Za-z0-9_.:-]+$/.test(normalized) ? normalized : '';
  }

  function elementTextContent(element) {
    if (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT|OPTION)$/i.test(element.tagName)) return '';
    var textParts = [];
    Array.prototype.forEach.call(element.childNodes || [], function (node) {
      if (node && node.nodeType === 3) textParts.push(node.textContent || '');
    });
    return safeText(textParts.join(' '), 500);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^A-Za-z0-9_-]/g, function (character) {
      return '\\' + character.charCodeAt(0).toString(16) + ' ';
    });
  }

  function isInspectable(element) {
    if (!(element instanceof Element)) return false;
    if (element.hasAttribute('data-yistack-visual-edit-overlay')) return false;
    return !/^(HTML|BODY|SCRIPT|STYLE|LINK|META|HEAD)$/i.test(element.tagName);
  }

  function selectorFor(element) {
    var testId = safeToken(element.getAttribute('data-testid'), 256);
    if (testId) return '[data-testid="' + testId + '"]';
    var id = safeToken(element.id, 128);
    if (id) return '#' + cssEscape(id);

    var segments = [];
    var current = element;
    while (current && current.nodeType === 1 && segments.length < 8) {
      var part = current.tagName.toLowerCase();
      var classNames = Array.prototype.slice.call(current.classList || []).filter(function (className) {
        return /^[A-Za-z0-9_-]+$/.test(className);
      }).slice(0, 2);
      if (classNames.length > 0) {
        part += '.' + classNames.map(cssEscape).join('.');
      }
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.tagName === current.tagName;
        });
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      }
      segments.unshift(part);
      current = parent;
      if (current && /^(MAIN|BODY)$/i.test(current.tagName)) {
        if (current.tagName.toLowerCase() === 'main') segments.unshift('main');
        break;
      }
    }
    return safeText(segments.join(' > '), 1024);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.setAttribute('data-yistack-visual-edit-overlay', 'true');
    overlay.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:2147483647;border:2px solid #0ea5e9;background:rgba(14,165,233,.10);box-shadow:0 0 0 1px rgba(255,255,255,.85) inset;';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function showOverlay(element) {
    var rect = element.getBoundingClientRect();
    var target = ensureOverlay();
    target.style.display = 'block';
    target.style.left = Math.round(rect.left) + 'px';
    target.style.top = Math.round(rect.top) + 'px';
    target.style.width = Math.max(0, Math.round(rect.width)) + 'px';
    target.style.height = Math.max(0, Math.round(rect.height)) + 'px';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  function computedStylesFor(element) {
    var computed = window.getComputedStyle(element);
    var result = {};
    styleProperties.forEach(function (property) {
      result[property] = safeText(computed.getPropertyValue(property), 256);
    });
    return result;
  }

  function selectionFor(element) {
    var rect = element.getBoundingClientRect();
    var classNames = Array.prototype.slice.call(element.classList || []).map(function (className) {
      return safeToken(className, 128);
    }).filter(Boolean).slice(0, 16);
    var selectionId = '';
    if (window.crypto && typeof window.crypto.randomUUID === 'function') selectionId = window.crypto.randomUUID();
    if (!selectionId) selectionId = 'selection-' + Date.now().toString(36);
    return {
      schema_version: schema,
      selection_id: selectionId,
      page_path: safeText(window.location.pathname || '/', 2048),
      selector: selectorFor(element),
      tag_name: safeText(element.tagName.toLowerCase(), 32),
      role: safeText(element.getAttribute('role'), 64),
      accessible_name: safeText(element.getAttribute('aria-label') || element.getAttribute('alt'), 256),
      text_content: elementTextContent(element),
      test_id: safeToken(element.getAttribute('data-testid'), 256),
      class_names: classNames,
      rect: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100
      },
      computed_styles: computedStylesFor(element)
    };
  }

  function post(type, payload) {
    var message = payload || {};
    message.type = type;
    message.schema_version = schema;
    window.parent.postMessage(message, parentOrigin);
  }

  document.addEventListener('mousemove', function (event) {
    if (!enabled || !isInspectable(event.target)) return;
    hovered = event.target;
    showOverlay(hovered);
  }, true);

  document.addEventListener('click', function (event) {
    if (!enabled || !isInspectable(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    hovered = event.target;
    showOverlay(hovered);
    post('yistack:visual-edit-selection', { selection: selectionFor(hovered) });
  }, true);

  document.addEventListener('keydown', function (event) {
    if (!enabled || event.key !== 'Escape') return;
    enabled = false;
    hovered = null;
    hideOverlay();
    post('yistack:visual-edit-cancelled', {});
  }, true);

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    var data = event.data;
    if (!data || data.type !== 'yistack:visual-edit-control' || data.schema_version !== schema) return;
    enabled = data.enabled === true;
    if (!enabled) {
      hovered = null;
      hideOverlay();
    }
  });

  post('yistack:visual-edit-ready', {});
})();`
