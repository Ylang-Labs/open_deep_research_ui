'use client';

import React, { useRef } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useLangGraphRuntime } from '@assistant-ui/react-langgraph';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AssistantSidebar';
import { createThread, getThreadState, sendMessage } from '@/lib/chatApi';
import { MessagesSquare } from 'lucide-react';

export function AppRootProviders({ children }: { children: React.ReactNode }) {
  const threadIdRef = useRef<string | undefined>(undefined);

  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages, { command }) => {
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;
      }
      const threadId = threadIdRef.current!;
      return sendMessage({ threadId, messages, command });
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
      <SidebarProvider>
        {/* Right sidebar for research activity/sources */}
        <AppSidebar />
        {/* Simple floating trigger */}
        <div className="fixed right-3 top-3 z-40">
          <SidebarTrigger aria-label="Toggle research sidebar">
            <MessagesSquare className="h-4 w-4" />
          </SidebarTrigger>
        </div>
        {children}
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
}
