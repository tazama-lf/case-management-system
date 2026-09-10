"""Shared postMessage contract with the parent CMS frame (VoilaFrame.tsx).

This is the single source of truth for the notebook -> parent completion
signal's exact shape: {source: 'voila-notebook', status: 'ready' | 'error'}.
The TypeScript side's copy of this contract lives in VoilaFrame.tsx's
VoilaNotebookMessage interface and isVoilaNotebookMessage guard - if the two
drift (e.g. a typo in 'voila-notebook'), the parent silently times out after
readyTimeoutMs instead of ever seeing 'ready', since there's no end-to-end
test across the JS/Python boundary that would catch that. Change this file,
not an inline copy in a notebook's final cell, if the contract ever needs to
change.

Usage - as the very last cell of a notebook, after all rendering is done:
    %run _cms_signal_ready.py
    signal_ready(_cms_render_ok)
"""

import json as _cms_json
from IPython.display import display, Javascript


def signal_ready(render_ok):
    """Posts the notebook's completion status to the parent CMS frame.

    `render_ok` should be the notebook's own _cms_render_ok flag (see the
    shared error-handling preamble in cell 0 of each notebook) - True unless
    some cell called display_fetch_error() (tone='error').
    """
    status = 'ready' if render_ok else 'error'
    payload = _cms_json.dumps({'source': 'voila-notebook', 'status': status})
    display(Javascript(f"window.parent.postMessage({payload}, '*');"))
