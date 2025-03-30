import { Block } from "@/components/create-block";
import { toast } from "sonner";

interface CustomMetadata {
  lastUpdated: string;
}

export const custom = new Block<"custom", CustomMetadata>({
  kind: "custom",
  description: "A custom block for demonstrating custom functionality.",
  
  initialize: async ({ documentId, setMetadata }) => {
    setMetadata({
      lastUpdated: new Date().toISOString(),
    });
  },

  onStreamPart: ({ streamPart, setMetadata, setBlock }) => {
    if (streamPart.type === "text-delta") {
      setBlock((draftBlock) => ({
        ...draftBlock,
        content: draftBlock.content + (streamPart.content as string),
        status: "streaming",
      }));
    }
  },

  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <div>Loading custom block...</div>;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);
      return (
        <div>
          <h3>Diff View</h3>
          <pre>{oldContent}</pre>
          <pre>{newContent}</pre>
        </div>
      );
    }

    return (
      <div className="custom-block p-4">
        <div className="mb-4">
          <textarea
            className="w-full p-2 border rounded"
            value={content}
            onChange={(e) => onSaveContent(e.target.value, true)}
            placeholder="Enter your content here..."
          />
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date(metadata.lastUpdated).toLocaleString()}
        </div>
        <button
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            navigator.clipboard.writeText(content);
            toast.success("Content copied to clipboard!");
          }}
        >
          Copy Content
        </button>
      </div>
    );
  },

  actions: [
    {
      icon: <span>⟳</span>,
      description: "Refresh block",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('latest');
      },
    },
  ],

  toolbar: [
    {
      icon: <span>✎</span>,
      description: "Edit block",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content: "Edit the custom block content.",
        });
      },
    },
  ],
}); 