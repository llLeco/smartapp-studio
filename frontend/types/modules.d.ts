declare module 'styled-components';
declare module 'react-icons/fa';
declare module 'react-markdown' {
  import { FC, ReactNode } from 'react';
  export interface Components {
    [key: string]: FC<any>;
  }
  export interface ReactMarkdownProps {
    children: string;
    components?: Components;
  }
  const ReactMarkdown: FC<ReactMarkdownProps>;
  export default ReactMarkdown;
}

declare module 'react-markdown/lib/ast-to-react' {
  import { ReactNode } from 'react';
  export interface CodeProps {
    node?: any;
    inline?: boolean;
    className?: string;
    children?: ReactNode;
  }
}

declare module 'react-markdown/lib/complex-types'; 