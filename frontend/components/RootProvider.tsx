'use client';

import React, { useRef } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useLangGraphRuntime } from '@assistant-ui/react-langgraph';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AssistantSidebar';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { createThread, getThreadState, sendMessage } from '@/lib/chatApi';
import { MessagesSquare, Cog } from 'lucide-react';
import {
  DeepResearchConfigProvider,
  useDeepResearchConfig,
} from '@/components/ConfigContext';

function ProvidersInner({ children }: { children: React.ReactNode }) {
  const threadIdRef = useRef<string | undefined>(undefined);
  const { config } = useDeepResearchConfig();

  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;
      }
      const threadId = threadIdRef.current!;
      return sendMessage({ threadId, messages, command, config });
    },
    onSwitchToNewThread: async () => {
      const { thread_id } = await createThread();
      threadIdRef.current = thread_id;
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      return { messages: state.values.messages };
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Left settings sidebar with independent state */}
      <SidebarProvider>
        <SettingsSidebar />
        <div className="fixed left-3 top-3 z-30">
          <SidebarTrigger aria-label="Toggle settings sidebar" hideWhenOpen>
            <Cog className="h-4 w-4" />
          </SidebarTrigger>
        </div>
      </SidebarProvider>

      {/* Right research sidebar with independent state */}
      <SidebarProvider>
        <AppSidebar />
        <div className="fixed right-3 top-3 z-30">
          <SidebarTrigger aria-label="Toggle research sidebar" hideWhenOpen>
            <MessagesSquare className="h-4 w-4" />
          </SidebarTrigger>
        </div>
      </SidebarProvider>

      {children}
    </AssistantRuntimeProvider>
  );
}

export function AppRootProviders({ children }: { children: React.ReactNode }) {
  return (
    <DeepResearchConfigProvider>
      <ProvidersInner>{children}</ProvidersInner>
    </DeepResearchConfigProvider>
  );
}
