'use client';

import { useRouter } from 'next/navigation';
import { api } from '~/trpc/react';

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateBaseModal({ isOpen, onClose }: CreateBaseModalProps) {
  const router = useRouter();
  const utils = api.useUtils();
  
  const createBase = api.base.create.useMutation({
    onSuccess: async (newBase) => {
      // Optimistically update the base list
      await utils.base.list.invalidate();
      
      // Create the default table
      const table = await createTable.mutateAsync({
        baseId: newBase.id,
        name: 'Table 1',
      });
      
      // Navigate to the new base/table
      router.push(`/base/${newBase.id}/table/${table.id}`);
      onClose();
    },
  });

  const createTable = api.table.create.useMutation();

  const isCreating = createBase.isPending || createTable.isPending;

  const handleCreateBlankBase = () => {
    if (isCreating) return;
    
    createBase.mutate({
      name: `Base ${new Date().toLocaleDateString()}`,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50"
        onClick={onClose}
        style={{ pointerEvents: 'all', backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ pointerEvents: 'none', padding: '24px' }}
      >
        <div
          className="relative flex flex-col"
          style={{
            width: '752px',
            backgroundColor: 'rgb(255, 255, 255)',
            marginLeft: 'auto',
            marginRight: 'auto',
            overflow: 'hidden',
            pointerEvents: 'all',
            animation: 'bounceIn 0.24s',
            boxShadow: 'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
            borderRadius: '14px'
          }}
          role="dialog"
        >
          {/* Header */}
          <div 
            className="flex flex-col justify-end border-bottom"
            style={{
              paddingTop: '20px',
              paddingBottom: '20px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <h2 
              className="font-family-default heading-size-large text-color-default line-height-3 font-weight-stronger"
              style={{
                fontSize: '23px',
                fontWeight: 600,
                lineHeight: '28.75px',
                marginLeft: '24px',
                marginTop: 0,
                marginBottom: 0
              }}
            >
              How do you want to start?
            </h2>
          </div>

          {/* Workspace selector */}
          <div 
            className="flex items-center"
            style={{
              paddingTop: '24px',
              paddingLeft: '24px',
              paddingRight: '24px'
            }}
          >
            <p 
              className="font-family-default text-size-large text-color-default line-height-4 font-weight-strong"
              style={{
                fontSize: '15px',
                fontWeight: 500,
                lineHeight: '22.5px',
                marginRight: '4px',
                marginTop: 0,
                marginBottom: 0
              }}
            >
              Workspace:
            </p>
            <div 
              tabIndex={0}
              role="button"
              className="pointer flex items-center focus-visible"
              aria-label="Workspace"
              aria-expanded="false"
              aria-haspopup="true"
              style={{ cursor: 'pointer' }}
            >
              <p 
                className="font-family-default text-size-large line-height-4 font-weight-default no-user-select"
                style={{
                  fontSize: '15px',
                  fontWeight: 400,
                  lineHeight: '22.5px',
                  marginRight: '2px',
                  color: 'rgb(97, 102, 112)',
                  marginTop: 0,
                  marginBottom: 0
                }}
              >
                Workspace
              </p>
              <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none flex-none" style={{ shapeRendering: 'geometricprecision', marginTop: '4px', marginBottom: '4px' }}>
                <use fill="currentColor" href="/icons/icon_definitions.svg#ChevronDown"></use>
              </svg>
            </div>
          </div>

          {/* Cards container */}
          <div 
            className="flex flex-col"
            style={{
              padding: '24px'
            }}
          >
            <div className="flex">
              {/* Build with Omni card */}
              <div
                tabIndex={0}
                role="button"
                className="flex flex-col rounded-big pointer shadow-elevation-low-hover shadow-elevation-low focus-visible"
                style={{
                  width: '340px',
                  marginRight: '24px',
                  borderRadius: '6px',
                  boxShadow: 'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
                  cursor: 'pointer'
                }}
              >
                {/* Image section */}
                <div 
                  className="width-full flex flex-col items-center justify-end rounded-big-top relative"
                  style={{
                    height: '200px',
                    borderTopLeftRadius: '6px',
                    borderTopRightRadius: '6px'
                  }}
                >
                  <div 
                    className="absolute"
                    style={{
                      right: '72px',
                      bottom: '34px'
                    }}
                  />
                  <img 
                    src="https://static.airtable.com/images/Fast App Setup/Omni_2x.png"
                    alt="Image in modal shown for creating base."
                    className="width-full height-full rounded-big-top"
                    style={{
                      objectFit: 'cover',
                      aspectRatio: '1.7 / 1',
                      borderTopLeftRadius: '6px',
                      borderTopRightRadius: '6px',
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>

                {/* Content section */}
                <div style={{ padding: '16px' }}>
                  <div className="flex items-center" style={{ marginBottom: '8px' }}>
                    <h2 
                      className="font-family-default heading-size-default text-color-default line-height-3 font-weight-stronger"
                      style={{
                        fontSize: '21px',
                        fontWeight: 600,
                        lineHeight: '26.25px',
                        marginTop: 0,
                        marginBottom: 0
                      }}
                    >
                      Build an app with Omni
                    </h2>
                    <div 
                      className="pill flex-inline items-center flex-none text-size-small"
                      style={{
                        backgroundColor: 'rgb(207, 245, 209)',
                        color: 'rgb(0, 100, 0)',
                        borderRadius: '9999px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        fontSize: '11px',
                        marginLeft: '8px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      New
                    </div>
                  </div>
                  <span 
                    className="font-family-default text-size-large text-color-quiet line-height-4 font-weight-default"
                    style={{
                      fontSize: '15px',
                      fontWeight: 400,
                      lineHeight: '22.5px',
                      color: 'rgb(97, 102, 112)',
                      display: 'block'
                    }}
                  >
                    Use AI to build a custom app tailored to your workflow.
                  </span>
                </div>
              </div>

              {/* Build on your own card */}
              <div
                tabIndex={0}
                role="button"
                className="flex flex-col rounded-big pointer shadow-elevation-low-hover shadow-elevation-low focus-visible"
                onClick={handleCreateBlankBase}
                style={{
                  width: '340px',
                  borderRadius: '6px',
                  boxShadow: 'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.6 : 1
                }}
              >
                {/* Image section */}
                <div 
                  className="width-full flex flex-col items-center justify-end rounded-big-top relative"
                  style={{
                    height: '200px',
                    borderTopLeftRadius: '6px',
                    borderTopRightRadius: '6px'
                  }}
                >
                  <div 
                    className="absolute"
                    style={{
                      right: '72px',
                      bottom: '34px'
                    }}
                  />
                  <img 
                    src="https://static.airtable.com/images/Fast App Setup/start-with-data.png"
                    alt="Image in modal shown for creating base."
                    className="width-full height-full rounded-big-top"
                    style={{
                      objectFit: 'cover',
                      aspectRatio: '1.7 / 1',
                      borderTopLeftRadius: '6px',
                      borderTopRightRadius: '6px',
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>

                {/* Content section */}
                <div style={{ padding: '16px' }}>
                  <div className="flex items-center" style={{ marginBottom: '8px' }}>
                    <h2 
                      className="font-family-default heading-size-default text-color-default line-height-3 font-weight-stronger"
                      style={{
                        fontSize: '21px',
                        fontWeight: 600,
                        lineHeight: '26.25px',
                        marginTop: 0,
                        marginBottom: 0
                      }}
                    >
                      Build an app on your own
                    </h2>
                  </div>
                  <span 
                    className="font-family-default text-size-large text-color-quiet line-height-4 font-weight-default"
                    style={{
                      fontSize: '15px',
                      fontWeight: 400,
                      lineHeight: '22.5px',
                      color: 'rgb(97, 102, 112)',
                      display: 'block'
                    }}
                  >
                    Start with a blank app and build your ideal workflow.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Close button */}
          <div
            tabIndex={0}
            role="button"
            className="absolute top-0 right-0 circle flex items-center justify-center pointer focus-visible"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: '24px',
              height: '24px',
              marginTop: '24px',
              marginRight: '16px',
              borderRadius: '50%',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" aria-hidden="true" style={{ shapeRendering: 'geometricprecision', opacity: 0.5 }}>
              <use fill="currentColor" href="/icons/icon_definitions.svg#X"></use>
            </svg>
          </div>
        </div>
      </div>

      {/* Add bounce animation */}
      <style jsx>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
