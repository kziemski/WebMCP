import { Thread } from '@/entrypoints/sidepanel/components/assistant-ui/thread';
import { ThreadList } from '@/entrypoints/sidepanel/components/assistant-ui/thread-list';
import { TooltipIconButton } from '@/entrypoints/sidepanel/components/assistant-ui/tooltip-icon-button';
import { ToolSelector } from '@/entrypoints/sidepanel/components/tool-selector';
import { Button } from '@/entrypoints/sidepanel/components/ui/button';
import { AssistantRuntimeProvider, useAssistantRuntime } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { McpClientProvider } from '@mcp-b/mcp-react-hooks';
import { createFileRoute } from '@tanstack/react-router';
import {
  BrainCircuitIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  MenuIcon,
  PlusIcon,
  Settings2Icon,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { client, transport } from '../lib/client';
import {
  modelConfigCollection,
  defaultModelConfig,
  getModelName,
  getAPIKey,
} from '../lib/modelConfig';
import { useLiveQuery, eq } from '@tanstack/react-db';

// Separate toolbar component to access runtime context
const ChatToolbar = ({
  onOpenSidebar,
  onOpenToolSelector,
}: {
  onOpenSidebar: () => void;
  onOpenToolSelector: () => void;
}) => {
  const navigate = useNavigate();
  const runtime = useAssistantRuntime();

  const handleNewThread = () => {
    // Use the threadList API if available, otherwise fallback to runtime method
    if (runtime.threadList) {
      runtime.threadList.switchToNewThread();
    } else if (runtime.switchToNewThread) {
      runtime.switchToNewThread();
    }
  };

  return (
    <div className="toolbar-surface">
      <div className="toolbar-inner">
        <div className="toolbar-group">
          <Button variant="ghost" size="sm" className="btn-toolbar-primary" onClick={onOpenSidebar}>
            <MenuIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Threads</span>
          </Button>

          <div className="w-px h-6 bg-border/50 mx-1" />

          <TooltipIconButton
            tooltip="New Thread"
            variant="ghost"
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-colors"
            onClick={handleNewThread}
          >
            <PlusIcon className="h-4 w-4" />
          </TooltipIconButton>

          <TooltipIconButton
            tooltip="Select Tools"
            variant="ghost"
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-colors"
            onClick={onOpenToolSelector}
          >
            <BrainCircuitIcon className="h-4 w-4" />
          </TooltipIconButton>

          <TooltipIconButton
            tooltip="Settings"
            variant="ghost"
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-colors"
            onClick={() => navigate({ to: '/settings' })}
          >
            <Settings2Icon className="h-4 w-4" />
          </TooltipIconButton>
        </div>

        <div className="toolbar-group">
          <TooltipIconButton
            tooltip="Help (Coming Soon)"
            variant="ghost"
            className="h-9 w-9 p-0 hover:bg-primary/10 transition-colors"
            disabled
          >
            <HelpCircleIcon className="h-4 w-4 text-muted-foreground" />
          </TooltipIconButton>
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);

  const lqConfig = useLiveQuery((q) =>
    q
      .from({ modelConfig: modelConfigCollection })
      .where(({ modelConfig }) => eq(modelConfig.id, '1'))
  );
  const modelConfig = lqConfig.data?.[0] || defaultModelConfig;

  // // Example 1: Custom API URL while keeping system/tools forwarding
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: 'http://localhost:8787/api/chat', // Custom API URL with trusted HTTPS for secure local dev
      headers: {
        'x-model-provider': modelConfig.modelProvider,
        'x-model-name': getModelName(modelConfig) || '',
        'x-api-key': getAPIKey(modelConfig) || '',
      },
    }),
    sendAutomaticallyWhen: (messages) => lastAssistantMessageIsCompleteWithToolCalls(messages),
  }); // Allow other components to open the tool selector via a window event
  useEffect(() => {
    const handler = () => setIsToolSelectorOpen(true);
    window.addEventListener('open-tool-selector', handler as EventListener);
    return () => window.removeEventListener('open-tool-selector', handler as EventListener);
  }, []);

  return (
    <McpClientProvider client={client} transport={transport} opts={{}}>
      <AssistantRuntimeProvider runtime={runtime}>
        {isToolSelectorOpen ? (
          // Tool selector view
          <ToolSelector onClose={() => setIsToolSelectorOpen(false)} />
        ) : isSidebarOpen ? (
          // Thread list takes over entire sidepanel
          <div className="h-full bg-background flex flex-col">
            <div className="flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto h-full">
                <ThreadList onThreadSelect={() => setIsSidebarOpen(false)} />
              </div>
            </div>
            {/* Bottom bar aligned with toolbar */}
            <div className="toolbar-surface">
              <div className="toolbar-inner">
                <h2 className="font-semibold text-sm">Threads</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 flex items-center gap-2 hover:bg-primary/10 transition-colors"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <span className="text-xs font-medium">Back to Chat</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Chat view with toolbar
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <Thread />
            </div>
            <ChatToolbar
              onOpenSidebar={() => setIsSidebarOpen(true)}
              onOpenToolSelector={() => setIsToolSelectorOpen(true)}
            />
          </div>
        )}
      </AssistantRuntimeProvider>
    </McpClientProvider>
  );
};

export const Route = createFileRoute('/chat/')({
  component: Chat,
});
