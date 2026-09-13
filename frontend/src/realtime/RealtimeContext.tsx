import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { wsUrl } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/Toast";

export type CallKind = "audio" | "video";
export type CallState = "outgoing" | "incoming" | "connecting" | "active" | "ended";

export type ActiveCall = {
  peerCode: string;
  peerName: string;
  kind: CallKind;
  role: "caller" | "callee";
  state: CallState;
};

type IncomingCall = { fromCode: string; fromName: string; kind: CallKind };

type RealtimeState = {
  connected: boolean;
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  startCall: (peerCode: string, peerName: string, kind: CallKind) => void;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  endCall: () => void;
};

const RealtimeContext = createContext<RealtimeState | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { show } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const activeRef = useRef<ActiveCall | null>(null);
  activeRef.current = activeCall;

  const send = useCallback((payload: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(wsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (token) connect();
      }, 2500);
    };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      let data: any;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleMessage(data);
    };
  }, [token]);

  const handleMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case "message": {
          const m = data.message;
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({
            queryKey: ["messages", m.connection_id, m.context],
          });
          break;
        }
        case "notification": {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          if (data.notification?.title) show(data.notification.title, "info");
          break;
        }
        case "call:invite": {
          if (activeRef.current) {
            send({ type: "call:decline", to: data.from });
            return;
          }
          setIncomingCall({
            fromCode: data.from,
            fromName: data.from_name || "Traksha member",
            kind: data.kind || "audio",
          });
          break;
        }
        case "call:accept": {
          if (activeRef.current && activeRef.current.role === "caller") {
            setActiveCall({ ...activeRef.current, state: "active" });
          }
          break;
        }
        case "call:decline": {
          if (activeRef.current) {
            show("Call declined", "info");
            setActiveCall(null);
          }
          break;
        }
        case "call:end": {
          if (activeRef.current) {
            setActiveCall({ ...activeRef.current, state: "ended" });
            setTimeout(() => setActiveCall(null), 400);
          }
          setIncomingCall(null);
          break;
        }
        default:
          break;
      }
    },
    [send, show],
  );

  useEffect(() => {
    if (token) connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, connect]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && token) connect();
    });
    return () => sub.remove();
  }, [token, connect]);

  const startCall = useCallback(
    (peerCode: string, peerName: string, kind: CallKind) => {
      const call: ActiveCall = {
        peerCode,
        peerName,
        kind,
        role: "caller",
        state: "outgoing",
      };
      setActiveCall(call);
      send({ type: "call:invite", to: peerCode, kind });
      router.push("/call");
    },
    [send],
  );

  const acceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    send({ type: "call:accept", to: incomingCall.fromCode });
    setActiveCall({
      peerCode: incomingCall.fromCode,
      peerName: incomingCall.fromName,
      kind: incomingCall.kind,
      role: "callee",
      state: "active",
    });
    setIncomingCall(null);
    router.push("/call");
  }, [incomingCall, send]);

  const declineIncoming = useCallback(() => {
    if (incomingCall) send({ type: "call:decline", to: incomingCall.fromCode });
    setIncomingCall(null);
  }, [incomingCall, send]);

  const endCall = useCallback(() => {
    if (activeCall) send({ type: "call:end", to: activeCall.peerCode });
    setActiveCall(null);
  }, [activeCall, send]);

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        incomingCall,
        activeCall,
        startCall,
        acceptIncoming,
        declineIncoming,
        endCall,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
