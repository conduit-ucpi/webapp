import React, { Fragment, type ReactNode } from 'react';

/**
 * Fill `{name}` placeholders in a translated sentence with JSX — inline code, a link, a bold
 * figure — so the sentence stays one catalogue key and each language puts the elements where
 * its own word order wants them. Placeholders with no node given are left as written, for the
 * same reason interpolate() leaves them: a visible `{amount}` gets reported, a gap does not.
 */
export function withNodes(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in nodes ? <Fragment key={i}>{nodes[name]}</Fragment> : part;
  });
}
