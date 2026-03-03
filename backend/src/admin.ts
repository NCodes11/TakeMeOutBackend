import { AdminFilters } from './types.js';

type AdminTab = 'tripFeedback' | 'featureRequests';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildParams = (tab: AdminTab, filters: AdminFilters, token?: string) => {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (token) params.set('token', token);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.thumbsUp && filters.thumbsUp !== 'all') params.set('thumbsUp', filters.thumbsUp);
  if (filters.category) params.set('category', filters.category);
  if (filters.city) params.set('city', filters.city);
  if (filters.state) params.set('state', filters.state);
  if (filters.q) params.set('q', filters.q);
  return params.toString();
};

const renderTable = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return '<p>No rows found for current filters.</p>';
  const columns = Object.keys(rows[0]);
  const header = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns.map((col) => `<td>${escapeHtml(row[col])}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
};

export const renderAdminPage = ({
  tab,
  filters,
  token,
  tripRows,
  featureRows,
}: {
  tab: AdminTab;
  filters: AdminFilters;
  token?: string;
  tripRows: Record<string, unknown>[];
  featureRows: Record<string, unknown>[];
}) => {
  const tabTitle = tab === 'tripFeedback' ? 'Trip Feedback' : 'Feature Requests';
  const exportBase = tab === 'tripFeedback' ? '/admin/export/tripFeedback' : '/admin/export/featureRequests';
  const tabParams = buildParams(tab, filters, token);
  const rows = tab === 'tripFeedback' ? tripRows : featureRows;

  const tripTabParams = buildParams('tripFeedback', filters, token);
  const featureTabParams = buildParams('featureRequests', filters, token);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Feedback Admin</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 24px; color: #111; }
      h1 { margin: 0 0 12px; }
      .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
      .tab { padding: 8px 12px; border: 1px solid #d0d7de; border-radius: 8px; text-decoration: none; color: #111; }
      .tab.active { background: #111; color: white; }
      .panel { border: 1px solid #d0d7de; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
      .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
      input, select { padding: 8px; border: 1px solid #c9d1d9; border-radius: 8px; font-size: 14px; }
      button, .button { display: inline-block; margin-top: 10px; margin-right: 8px; padding: 8px 12px; border-radius: 8px; border: 1px solid #c9d1d9; background: #fff; color: #111; text-decoration: none; cursor: pointer; }
      table { border-collapse: collapse; width: 100%; overflow: auto; font-size: 12px; }
      th, td { border: 1px solid #d0d7de; padding: 6px; text-align: left; vertical-align: top; }
      th { background: #f6f8fa; position: sticky; top: 0; }
      .table-wrap { overflow: auto; max-height: 65vh; }
      .hint { color: #57606a; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Feedback Admin</h1>
    <div class="tabs">
      <a class="tab ${tab === 'tripFeedback' ? 'active' : ''}" href="/admin?${tripTabParams}">Trip Feedback</a>
      <a class="tab ${tab === 'featureRequests' ? 'active' : ''}" href="/admin?${featureTabParams}">Feature Requests</a>
    </div>

    <div class="panel">
      <h2 style="margin-top:0">${escapeHtml(tabTitle)}</h2>
      <form method="get">
        <input type="hidden" name="tab" value="${escapeHtml(tab)}" />
        ${token ? `<input type="hidden" name="token" value="${escapeHtml(token)}" />` : ''}
        <div class="filters">
          <label>Start date
            <input name="startDate" type="date" value="${escapeHtml(filters.startDate ?? '')}" />
          </label>
          <label>End date
            <input name="endDate" type="date" value="${escapeHtml(filters.endDate ?? '')}" />
          </label>
          ${
            tab === 'tripFeedback'
              ? `<label>Thumbs
            <select name="thumbsUp">
              <option value="all" ${filters.thumbsUp === 'all' ? 'selected' : ''}>All</option>
              <option value="up" ${filters.thumbsUp === 'up' ? 'selected' : ''}>Thumbs up</option>
              <option value="down" ${filters.thumbsUp === 'down' ? 'selected' : ''}>Thumbs down</option>
            </select>
          </label>`
              : `<label>Category
            <input name="category" placeholder="New Feature" value="${escapeHtml(filters.category ?? '')}" />
          </label>`
          }
          <label>City
            <input name="city" placeholder="Orlando" value="${escapeHtml(filters.city ?? '')}" />
          </label>
          <label>State
            <input name="state" placeholder="FL" value="${escapeHtml(filters.state ?? '')}" />
          </label>
          <label>Keyword
            <input name="q" placeholder="search text" value="${escapeHtml(filters.q ?? '')}" />
          </label>
        </div>
        <button type="submit">Apply filters</button>
      </form>

      <a class="button" href="${exportBase}.csv?${tabParams}">Export CSV</a>
      <a class="button" href="${exportBase}.json?${tabParams}">Export JSON</a>
      <p class="hint">Use <code>?token=...</code> in the URL to keep export links authenticated.</p>
    </div>

    <div class="panel table-wrap">
      ${renderTable(rows)}
    </div>
  </body>
</html>`;
};
