import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ThreePanelLayout from '../Layout/ThreePanelLayout';
import TopNav from '../Layout/TopNav';
import ChatPanel from './ChatPanel';
import PreviewPanel from './PreviewPanel';
import CodeView, { type CodeFile } from './CodeView';
import { StatusIndicator } from '../Common';
import { sessionsApi } from '@/api/sessions';
import { useSSE } from '@/hooks/useSSE';
import { SessionState } from '@/types/session';
import type { Message } from './ChatPanel';

export default function ProjectWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [showCodeView, setShowCodeView] = useState(false);
  // TODO: Load code files from session/version data
  const [codeFiles] = useState<CodeFile[]>([]);
  // const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [currentStatus, setCurrentStatus] = useState<SessionState | null>(null);

  // Debug: Log messages state changes
  useEffect(() => {
    console.log('ProjectWorkspace - messages updated:', messages.length, messages);
  }, [messages]);

  // Fetch session data
  const { data: session, isLoading: isLoadingSession, refetch: refetchSession } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionsApi.getSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // Only poll if session is not in final state
      const sessionData = query.state.data;
      if (sessionData?.state === SessionState.READY || sessionData?.state === SessionState.FAILED) {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

  // Update current status from session
  useEffect(() => {
    if (session) {
      setCurrentStatus(session.state);
    }
  }, [session]);

  // SSE Streaming for real-time updates (Phase 4 - will be used fully then)
  useSSE(sessionId || null, {
    enabled: !!sessionId,
    onEvent: (event) => {
      // Handle different event types
      if (event.type === 'status') {
        setCurrentStatus(event.data.state);
        refetchSession();
      } else if (event.type === 'message') {
        // Add AI message to chat
        const aiMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: event.data.content || event.data.message || '',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else if (event.type === 'error') {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: `Error: ${event.data.message || 'An error occurred'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else if (event.type === 'done') {
        refetchSession();
      }
    },
  });

  const handleSendPrompt = async (prompt: string) => {
    if (!sessionId) return;

    console.log('handleSendPrompt called with:', prompt);

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    console.log('Adding user message:', userMessage);
    setMessages((prev) => {
      // Ensure we don't duplicate messages
      const exists = prev.find(m => m.id === userMessage.id);
      if (exists) {
        console.log('Message already exists, skipping');
        return prev;
      }
      const newMessages = [...prev, userMessage];
      console.log('New messages array:', newMessages.length, newMessages);
      return newMessages;
    });
    setCurrentStatus(SessionState.GENERATING);

    try {
      await sessionsApi.sendPrompt(sessionId, prompt);
      refetchSession();
    } catch (error) {
      console.error('Failed to send prompt:', error);
      setCurrentStatus(SessionState.FAILED);
      
      // Extract error message from API response
      // axios interceptor returns error.response.data, so error is already the data object
      let errorMsg = 'Failed to send prompt';
      if (error && typeof error === 'object') {
        const apiError = error as { message?: string; error?: string };
        errorMsg = apiError.message || apiError.error || errorMsg;
      } else if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        // Ensure we don't duplicate error messages
        const exists = prev.find(m => m.id === errorMessage.id);
        if (exists) return prev;
        return [...prev, errorMessage];
      });
      refetchSession();
    }
  };

  const projectName = session?.id ? 'Project' : 'Loading...';
  const sessionState = currentStatus || session?.state;
  const isLoadingPreview = isLoadingSession || (sessionState !== null && sessionState !== SessionState.READY);
  const isLoading = sessionState === SessionState.GENERATING || 
                   sessionState === SessionState.BUILDING || 
                   sessionState === SessionState.VALIDATING ||
                   sessionState === SessionState.FIXING;

  return (
    <ThreePanelLayout
      topNav={
        <div className="flex items-center gap-4">
          <TopNav
            projectName={projectName}
            isLoading={isLoadingPreview}
            onPreviewToggle={() => {
              setShowPreview(!showPreview);
              if (showCodeView) setShowCodeView(false);
            }}
            onCodeViewToggle={() => {
              setShowCodeView(!showCodeView);
              if (showPreview) setShowPreview(false);
            }}
            showPreview={showPreview}
            showCodeView={showCodeView}
          />
          {sessionState && (
            <StatusIndicator state={sessionState} />
          )}
        </div>
      }
      leftPanel={
        <ChatPanel
          messages={messages}
          onSendPrompt={handleSendPrompt}
          isLoading={isLoading}
          disabled={false}
        />
      }
      rightPanel={
        showCodeView ? (
          <CodeView
            files={codeFiles}
            onClose={() => setShowCodeView(false)}
          />
        ) : (
          <PreviewPanel
            sessionId={sessionId}
            isLoading={isLoadingPreview}
            showOnboarding={isLoadingPreview}
          />
        )
      }
      showRightPanel={showPreview || showCodeView}
    />
  );
}
