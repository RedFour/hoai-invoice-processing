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
            <iframe
              key={url}
              src={attachment.url}
              width={500}
              height={600}
              title={attachment.name ?? `A pdf attachment`}
            />
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
