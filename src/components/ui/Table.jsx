import { cn } from '../../lib/cn';

/**
 * Data table with a mobile fallback.
 *
 * `.data-table { min-width: 600px }` forced every admin table into horizontal
 * scroll on a phone. Here the table is hidden below `md` and `renderCard`
 * supplies a stacked layout instead; the horizontal scroll container remains
 * for the tablet range so wide content never scrolls the page body.
 */
export default function Table({ columns, rows, keyField = 'id', onRowClick, renderCard, empty, className }) {
  if (!rows?.length) return empty ?? null;

  return (
    <>
      {/* Desktop / tablet */}
      <div className={cn('hidden md:block overflow-x-auto rounded-xl border border-line', className)}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-3">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'text-left font-semibold text-muted text-xs uppercase tracking-wide',
                    'px-4 py-3 whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-t border-line transition-colors',
                  onRowClick &&
                    'cursor-pointer hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-body', col.align === 'right' && 'text-right', col.cellClassName)}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      {renderCard && <div className="flex flex-col gap-2 md:hidden">{rows.map((row) => renderCard(row))}</div>}
    </>
  );
}
