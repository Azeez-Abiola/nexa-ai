import React from "react";

// Business-admin "Ask Nexa" page. Embeds the real end-user chat experience (the same UI +
// conversations sidebar rendered at /user-chat) in an iframe. Because the iframe is same-origin,
// it shares localStorage, so it authenticates with the admin's own nexa-token and chats scoped
// to their business unit — identical to what a regular employee sees.
const AskNexa: React.FC = () => {
  return (
    <div
      style={{
        height: "calc(100dvh - 170px)",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      <iframe
        src="/user-chat"
        title="Ask Nexa"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
};

export default AskNexa;
