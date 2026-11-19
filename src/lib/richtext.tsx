import React from 'react';
import { Text, type TextStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from './theme';

// Minimal inline-markup renderer for article text produced by extract-data.mjs:
//   **bold**  *italic*  `code`  [text](url)
// Links open in the in-app browser. Unknown markup is rendered as plain text.
type Tok =
  | { k: 'text'; t: string }
  | { k: 'bold'; t: string }
  | { k: 'italic'; t: string }
  | { k: 'code'; t: string }
  | { k: 'link'; t: string; url: string };

function tokenize(input: string): Tok[] {
  const out: Tok[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) out.push({ k: 'text', t: input.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ k: 'bold', t: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'link', t: m[2], url: m[3] });
    else if (m[4] !== undefined) out.push({ k: 'italic', t: m[4] });
    else if (m[5] !== undefined) out.push({ k: 'code', t: m[5] });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ k: 'text', t: input.slice(last) });
  return out;
}

export function RichText({
  text,
  style,
  onLinkPress,
}: {
  text: string;
  style?: TextStyle;
  onLinkPress?: (url: string) => void;
}) {
  const theme = useTheme();
  const open = async (url: string) => {
    if (onLinkPress) return onLinkPress(url);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // browser unavailable: ignore
    }
  };
  return (
    <Text style={style}>
      {tokenize(text).map((tok, i) => {
        switch (tok.k) {
          case 'bold':
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                {tok.t}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                {tok.t}
              </Text>
            );
          case 'code':
            return (
              <Text key={i} style={{ fontFamily: 'monospace', backgroundColor: theme.surface }}>
                {tok.t}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                style={{ textDecorationLine: 'underline' }}
                onPress={() => open(tok.url)}
              >
                {tok.t}
              </Text>
            );
          default:
            return <Text key={i}>{tok.t}</Text>;
        }
      })}
    </Text>
  );
}
