# Jupyter Visualizations for Case Management System

This directory contains the Jupyter notebooks used for interactive visualizations within the Case Management System (CIMS). These notebooks are rendered via [Voila](https://voila.readthedocs.io/) and embedded as iframes in the frontend.

## Prerequisites

- Python 3.8+
- [pip](https://pip.pypa.io/en/stable/installation/)

## Setup

1. **Navigate to the notebooks directory:**

   ```bash
   cd notebooks/
   ```

2. **Create and activate a virtual environment (optional but recommended):**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install voila plotly pandas requests papermill networkx
   ```

## Configuration

The notebooks fetch data from the NestJS backend. Ensure the backend is running and configured correctly.

- **Backend URL:** The notebooks default to `http://localhost:3000`. You can override this by setting the `CASE_MGMT_BACKEND_URL` environment variable.

## Running Locally

### 1. Using Voila (Recommended for Frontend Integration)

To serve the notebooks for embedment in the frontend, run Voila with the provided configuration:

```bash
voila --config voila.json
```

- This will start a server at `http://localhost:8866`.
- The frontend will look for visualizations at this address.
- The `voila.json` file handles necessary security headers (CSP) to allow iframe embedding.

### 2. Using JupyterLab (Recommended for Development)

If you want to edit the notebooks or explore data interactively:

```bash
pip install jupyterlab
jupyter lab
```

### 3. Parameters

The notebooks are parameterized to accept data from the frontend. When running via Voila, parameters are passed via URL query strings (e.g., `?entityId=123&filter=Last Month`).

## Notebooks

- **`transaction-viz.ipynb`**: Interactive analysis of transaction history, featuring dual-axis timelines, cumulative value charts, volume distribution, and a recent transactions table.
- **`transaction-network.ipynb`**: Transaction network diagram. Fetches from the network-analysis API, places the center account in the middle, and shows connected accounts in a circle. Used by the Transaction Network tab.
- **`alert-history.ipynb`**: Alert history visualization showing alert counts, cases opened, investigations over time, and alert value trends.
- **`conditions-context.ipynb`**: Transaction-based conditions context view showing both parties (debtor/creditor), their accounts, and condition statistics. Entry point for conditions timeline visualization.
- **`conditions-summary.ipynb`**: Conditions summary by account ID showing total, active, expired, and future conditions with a distribution donut chart.
- **`conditions-details.ipynb`**: Detailed condition records view with timeline visualization and full condition information (type, reason, dates, status).
- **`conditions-evaluated-transactions.ipynb`**: Evaluated transactions view showing transactions that were evaluated against conditions with outcomes (blocked, overridden, passed).

## Maintenance

### Updating Dependencies

If you add new libraries to a notebook (e.g., `seaborn`, `scikit-learn`), make sure to:

1. Update this README.
2. Update the `pip install` instructions.

### Security Note

The `voila.json` is configured to allow `frame-ancestors` from the frontend. Ensure the `Content-Security-Policy` matches your local/production frontend URL.
