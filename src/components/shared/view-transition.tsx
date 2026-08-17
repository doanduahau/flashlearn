import React from "react";

export function ViewTransition({
  children,
  name,
}: Readonly<{
  children: React.ReactNode;
  name?: string;
}>) {
  const ReactViewTransition =
    (
      React as unknown as {
        ViewTransition?: React.ComponentType<{ name?: string; children: React.ReactNode }>;
      }
    ).ViewTransition ||
    (
      React as unknown as {
        unstable_ViewTransition?: React.ComponentType<{
          name?: string;
          children: React.ReactNode;
        }>;
      }
    ).unstable_ViewTransition;

  if (ReactViewTransition) {
    return <ReactViewTransition name={name}>{children}</ReactViewTransition>;
  }

  return <div style={name ? { viewTransitionName: name } : undefined}>{children}</div>;
}
