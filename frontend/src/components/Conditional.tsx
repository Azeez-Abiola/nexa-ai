import React from "react";

interface ConditionalProps {
  isVisible: boolean;
  children: React.ReactNode;
}

const Conditional: React.FC<ConditionalProps> = ({ isVisible, children }) => {
  return isVisible ? <>{children}</> : null;
};

export default Conditional;
