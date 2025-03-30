import type { Attachment } from 'ai';
import { useState } from 'react';
import { LoaderIcon } from './icons';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: {
  attachment: Attachment;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;
  const [expanded, setExpanded] = useState(false);

  // For PDFs in the chat view, show a larger preview when expanded
  const isPdf = contentType === 'application/pdf';
  
  return (
    <div className="flex flex-col gap-2">
      <div 
        className={`${expanded && isPdf ? 'w-full h-96' : 'w-20 h-16'} aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300`}
        onClick={() => isPdf && setExpanded(!expanded)}
      >
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : contentType === 'application/pdf' ? (
            expanded ? (
              <object
                data={url}
                type="application/pdf"
                className="w-full h-full rounded-md"
              >
                <p>Your browser does not support embedded PDFs. 
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-500 hover:underline"
                  >
                    Click here to open the PDF.
                  </a>
                </p>
              </object>
            ) : (
              <div 
                className="flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer w-full h-full"
                title="Click to preview PDF"
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M7 18H17V16H7V18ZM7 14H17V12H7V14ZM7 10H17V8H7V10ZM5 22C4.45 22 3.97917 21.8042 3.5875 21.4125C3.19583 21.0208 3 20.55 3 20V4C3 3.45 3.19583 2.97917 3.5875 2.5875C3.97917 2.19583 4.45 2 5 2H15L21 8V20C21 20.55 20.8042 21.0208 20.4125 21.4125C20.0208 21.8042 19.55 22 19 22H5ZM14 9V4H5V20H19V9H14Z" 
                    fill="#ef4444"
                  />
                </svg>
              </div>
            )
          ) : (
            <div className="" />
          )
        ) : (
          <div className="" />
        )}

        {expanded && isPdf && (
          <div 
            className="absolute top-1 right-1 bg-black bg-opacity-50 text-white p-1 rounded-full cursor-pointer z-10"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            title="Close preview"
          >
            ✕
          </div>
        )}

        {!expanded && isPdf && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black bg-opacity-50 px-2 py-0.5 rounded">
            Click to preview
          </div>
        )}

        {isUploading && (
          <div className="animate-spin absolute text-zinc-500">
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">
        {contentType === 'application/pdf' ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline cursor-pointer"
            title="Click to open PDF in new tab"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </a>
        ) : (
          name
        )}
      </div>
    </div>
  );
};
