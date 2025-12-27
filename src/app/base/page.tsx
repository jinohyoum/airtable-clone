import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import Link from "next/link";
import BasePageHeader from "./_components/BasePageHeader";
import BaseSidebar from "./_components/BaseSidebar";

// Color palette matching Airtable
const colors = [
  { name: 'purple', bg: 'rgb(124, 55, 239)', text: 'white' },
  { name: 'green', bg: 'rgb(45, 194, 107)', text: 'white' },
  { name: 'cyan', bg: 'rgb(38, 188, 201)', text: 'rgb(29, 31, 37)' },
  { name: 'teal', bg: 'rgb(32, 201, 172)', text: 'rgb(29, 31, 37)' },
  { name: 'blue', bg: 'rgb(45, 127, 249)', text: 'white' },
  { name: 'orange', bg: 'rgb(255, 122, 0)', text: 'white' },
  { name: 'yellowLight2', bg: 'rgb(255, 213, 66)', text: 'rgb(29, 31, 37)' },
];

function getColorForBase(baseId: string) {
  const hash = baseId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length]!;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'Opened just now';
  if (diffInMinutes < 60) return `Opened ${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  if (diffInHours < 24) return `Opened ${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffInDays === 1) return 'Opened yesterday';
  return `Opened ${diffInDays} days ago`;
}

function groupBasesByTime(bases: Array<{ id: string; name: string; createdAt: Date; updatedAt: Date; lastAccessedAt: Date }>) {
  const now = new Date();
  const today: typeof bases = [];
  const past7Days: typeof bases = [];
  const past30Days: typeof bases = [];

  bases.forEach((base) => {
    const diffInDays = Math.floor((now.getTime() - base.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      today.push(base);
    } else if (diffInDays < 7) {
      past7Days.push(base);
    } else if (diffInDays < 30) {
      past30Days.push(base);
    }
  });

  return { today, past7Days, past30Days };
}

export default async function BasesPage() {
  const session = await auth();
  if (!session) redirect("/signin");

  // Get user's bases
  const bases = await api.base.list();
  const { today, past7Days, past30Days } = groupBasesByTime(bases);

  return (
    <div className="flex flex-col" style={{ height: '100vh', backgroundColor: 'rgb(249, 250, 251)' }}>
      <BasePageHeader />
      <div className="flex flex-1" style={{ overflow: 'hidden' }}>
        <BaseSidebar />
        <div className="flex-1" style={{ overflowY: 'auto' }}>
          <div style={{ maxWidth: '1920px', paddingLeft: '48px', paddingRight: '48px', paddingTop: '32px' }}>
            <div className="flex flex-col" style={{ height: '100%' }}>
              {/* Title */}
              <h1 style={{
                fontFamily: '"Inter Display", -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
                fontSize: '27px',
                fontWeight: 675,
                lineHeight: '33.75px',
                letterSpacing: '-0.16px',
                color: 'rgb(29, 31, 37)',
                textAlign: 'left',
                paddingBottom: '24px'
              }}>
                Home
              </h1>

              {/* Filter and View Controls */}
              <div className="flex flex-col">
                <div className="relative" style={{ paddingBottom: '10px', marginBottom: '-10px', zIndex: 5 }}>
                  <div className="flex items-center relative justify-between" style={{ paddingBottom: '20px', zIndex: 1, flexWrap: 'nowrap' }}>
                    <div className="flex items-center" style={{ marginRight: '8px' }}>
                      <div className="flex items-center" style={{ marginRight: '12px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          opacity: 0.75,
                          borderRadius: '3px'
                        }}>
                          <div style={{ marginRight: '4px' }}>
                            <p style={{
                              fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto',
                              fontSize: '15px',
                              color: 'rgb(29, 31, 37)',
                              lineHeight: '22.5px'
                            }}>
                              Opened anytime
                            </p>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                            <path fill="currentColor" d="M4 6l4 4 4-4z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex">
                      <div role="radiogroup" className="flex items-center">
                        <div style={{
                          display: 'flex',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          padding: '4px',
                          opacity: 0.75
                        }}>
                          <svg width="20" height="20" viewBox="0 0 16 16">
                            <path fill="currentColor" d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z"/>
                          </svg>
                        </div>
                        <div style={{
                          display: 'flex',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          padding: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.05)'
                        }}>
                          <svg width="20" height="20" viewBox="0 0 16 16">
                            <path fill="currentColor" d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Base Grid */}
              <div role="rowgroup" className="flex-auto" style={{ overflowY: 'auto', paddingLeft: '4px', paddingRight: '4px', minHeight: '500px' }}>
                {today.length > 0 && (
                  <BasesSection title="Today" bases={today} />
                )}
                {past7Days.length > 0 && (
                  <BasesSection title="Past 7 days" bases={past7Days} />
                )}
                {past30Days.length > 0 && (
                  <BasesSection title="Past 30 days" bases={past30Days} />
                )}
                {bases.length === 0 && (
                  <div className="text-center py-12">
                    <p style={{ color: 'rgb(97, 102, 112)', marginBottom: '16px' }}>You don't have any bases yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BasesSection({ title, bases }: { title: string; bases: Array<{ id: string; name: string; createdAt: Date; updatedAt: Date; lastAccessedAt: Date }> }) {
  return (
    <div className="flex flex-col width-full items-start" style={{ marginBottom: '24px' }}>
      <h4 style={{
        fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto',
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: '16.25px',
        color: 'rgb(97, 102, 112)',
        marginBottom: '8px'
      }}>
        {title}
      </h4>
      <div style={{
        width: '100%',
        marginTop: '4px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(286px, 1fr))',
        columnGap: '16px',
        rowGap: '16px'
      }}>
        {bases.map((base) => (
          <BaseCard key={base.id} base={base} />
        ))}
      </div>
    </div>
  );
}

async function BaseCard({ base }: { base: { id: string; name: string; createdAt: Date; updatedAt: Date; lastAccessedAt: Date } }) {
  // Get the first table in this base
  const tables = await api.table.list({ baseId: base.id });
  const firstTable = tables[0];

  const href = firstTable
    ? `/base/${base.id}/table/${firstTable.id}`
    : `/base/${base.id}`;

  const color = getColorForBase(base.id);
  const initials = base.name.slice(0, 2).toUpperCase();
  const relativeTime = getRelativeTime(base.lastAccessedAt);

  return (
    <Link
      href={href}
      className="relative pointer"
      style={{
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '6px',
        boxShadow: 'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
        height: '92px',
        minWidth: '286px',
        maxWidth: '572px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div className="flex" style={{ height: '100%' }}>
        {/* Color Avatar */}
        <div className="flex items-center justify-center relative" style={{
          width: '92px',
          height: '92px',
          minWidth: '92px',
          borderTopLeftRadius: '6px',
          borderBottomLeftRadius: '6px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            backgroundColor: color.bg,
            color: color.text,
            borderRadius: '12px',
            width: '56px',
            height: '56px',
            fontSize: '22px',
            fontWeight: 400
          }}>
            <span>{initials}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-auto justify-center" style={{
          textAlign: 'left',
          marginRight: '16px'
        }}>
          <div className="flex justify-between items-center">
            <div className="flex flex-auto">
              <h3 style={{
                fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto',
                fontSize: '13px',
                fontWeight: 500,
                lineHeight: '19.5px',
                color: 'rgb(29, 31, 37)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                maxHeight: '39px'
              }}>
                {base.name}
              </h3>
            </div>
            <div className="flex flex-none items-center absolute right-0 top-0" style={{
              zIndex: 1,
              marginLeft: '4px',
              marginRight: '16px',
              marginTop: '16px',
              borderRadius: '6px',
              backgroundColor: 'rgb(255, 255, 255)',
              minHeight: '28px'
            }}>
            </div>
          </div>
          <div className="flex items-center" style={{ marginTop: '4px' }}>
            <div style={{
              fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto',
              fontSize: '11px',
              color: 'rgb(97, 102, 112)',
              lineHeight: '16.5px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%'
            }}>
              <div className="flex items-center">
                <div style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  zIndex: 2
                }}>
                  {relativeTime}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
