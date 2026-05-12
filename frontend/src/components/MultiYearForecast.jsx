/**
 * MultiYearForecast — revenue breakdown table for multi-year contracts.
 * Visible only when term length > 12 months (FR-QUOTE-13).
 *
 * Pure presentational component.
 */
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function MultiYearForecast({ yearlySummary }) {
  if (!yearlySummary || yearlySummary.length === 0) return null;

  const totalRevenue = yearlySummary.reduce((sum, y) => sum + y.revenue, 0);

  return (
    <section aria-labelledby="forecast-heading" className="mt-4">
      <h2 className="h5 mb-3" id="forecast-heading">
        Multi-Year Revenue Forecast
      </h2>
      <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="text-end">
                Revenue
              </th>
              <th scope="col" className="text-end">
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            {yearlySummary.map(({ year, revenue }) => (
              <tr key={year}>
                <td>Year {year}</td>
                <td className="text-end">{USD.format(revenue)}</td>
                <td className="text-end">
                  {totalRevenue > 0
                    ? `${((revenue / totalRevenue) * 100).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="fw-semibold table-light">
            <tr>
              <td>Total</td>
              <td className="text-end">{USD.format(totalRevenue)}</td>
              <td className="text-end">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
