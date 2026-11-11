"""Shared plotly.js loading for the notebooks.

Plotly's default output embeds the whole plotly.js bundle (about 4.7 MB) in the HTML of every render. This module loads
it once per page instead, from a static file the browser caches (`/voila/files/plotly.min.js?v=<version>`), and runs
each chart script only after the library has arrived.

The file is copied into the notebooks folder when the image is built (see Dockerfile.voila) and exposed through
`file_allowlist` in voila.json. `_ensure_plotly_file()` copies it as a fallback when it is missing, for example when
Voila is started by hand outside the image.

Usage - once per notebook, with the other imports (importing it produces no output; each chart's HTML carries the loader):
    from _cms_plotly import plotly_graph_html, display_plotly, CMS_WHEN_PLOTLY_OPEN, CMS_WHEN_PLOTLY_CLOSE

Then:
    plotly_graph_html(fig, div_id, config)  -> the figure's HTML, drawn once plotly.js has loaded (replaces pio.to_html)
    display_plotly(fig)                      -> shows a figure (replaces fig.show())
    CMS_WHEN_PLOTLY_OPEN / CMS_WHEN_PLOTLY_CLOSE -> wrap a hand-written script that calls Plotly.* so it also waits

The notebook's final cell (_cms_signal_ready.py) holds back its 'ready' message until every deferred script has run.
"""

import json as _cms_json
import os as _cms_os
import re as _cms_re
import shutil as _cms_shutil

import plotly as _cms_plotly
import plotly.io as _cms_pio
from IPython.display import display as _cms_display, HTML as _cms_HTML

_CMS_PLOTLY_FILE = 'plotly.min.js'
_CMS_PLOTLY_URL = f'/voila/files/{_CMS_PLOTLY_FILE}?v={_cms_plotly.__version__}'

# An opening <script> tag with or without attributes (older plotly versions write type="text/javascript")
_CMS_SCRIPT_OPEN = _cms_re.compile(r'<script\b[^>]*>', _cms_re.IGNORECASE)

# Wrap a script that uses Plotly so it runs once the library has loaded: "<script>" + OPEN + body + CLOSE + "</script>"
CMS_WHEN_PLOTLY_OPEN = '__cmsWhenPlotly(function () {'
CMS_WHEN_PLOTLY_CLOSE = '});'

_CMS_PLOTLY_LOADER = """
(function () {
  if (window.__cmsWhenPlotly) { return; }
  var url = %s;
  var queue = [];
  var loading = false;
  window.__cmsPlotlyPending = 0;
  function run(fn) {
    try { fn(); } catch (e) { console.error('[plotly] chart script failed', e); }
    window.__cmsPlotlyPending -= 1;
  }
  window.__cmsWhenPlotly = function (fn) {
    window.__cmsPlotlyPending += 1;
    if (window.Plotly) { run(fn); return; }
    queue.push(fn);
    if (loading) { return; }
    loading = true;
    var script = document.createElement('script');
    script.src = url;
    script.onload = function () { queue.splice(0).forEach(run); };
    script.onerror = function () { console.error('[plotly] could not load ' + url); };
    document.head.appendChild(script);
  };
})();
""" % _cms_json.dumps(_CMS_PLOTLY_URL)


def _ensure_plotly_file():
    """Copies plotly.min.js next to the notebooks if the image build did not already put it there."""
    target = _cms_os.path.join(_cms_os.getcwd(), _CMS_PLOTLY_FILE)
    if _cms_os.path.exists(target):
        return
    source = _cms_os.path.join(_cms_os.path.dirname(_cms_plotly.__file__), 'package_data', _CMS_PLOTLY_FILE)
    temporary = f'{target}.{_cms_os.getpid()}.tmp'
    _cms_shutil.copyfile(source, temporary)
    _cms_os.replace(temporary, target)


def plotly_graph_html(fig, div_id=None, config=None, **to_html_kwargs):
    """The figure's div plus its draw script, with the draw deferred until plotly.js has loaded."""
    html = _cms_pio.to_html(fig, full_html=False, include_plotlyjs=False, config=config, div_id=div_id, **to_html_kwargs)
    # The figure's draw script is the last script in the output
    openings = list(_CMS_SCRIPT_OPEN.finditer(html))
    if not openings:
        raise ValueError('plotly produced no <script> to defer')
    open_tag = openings[-1].group(0)
    close_tag = '</script>'
    start = openings[-1].start()
    end = html.rindex(close_tag)
    body = html[start + len(open_tag):end]
    deferred = html[:start] + open_tag + CMS_WHEN_PLOTLY_OPEN + body + CMS_WHEN_PLOTLY_CLOSE + close_tag + html[end + len(close_tag):]
    return '<script>' + _CMS_PLOTLY_LOADER + close_tag + deferred


def display_plotly(fig, config=None):
    """Replacement for fig.show() that does not embed plotly.js (matches the 'notebook' renderer's 525px default height)."""
    _cms_display(_cms_HTML(plotly_graph_html(fig, config=config, default_height='525px')))


_ensure_plotly_file()
