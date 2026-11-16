import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * Markdown mínimo para las respuestas del Tutor IA: bloques ```código```, **negrita**, `código`
 * y viñetas con "* " o "- ". No es un renderizador completo: solo lo que Gemini usa a diario,
 * para que no se vean los asteriscos ni las comillas invertidas.
 */
export function MarkdownText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const blocks = text.split(/```[a-zA-Z]*\n?/);
  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.codeBlock} selectable>
            {block.replace(/\n$/, '')}
          </Text>
        ) : block.trim() === '' ? null : (
          <Text key={i} style={style} selectable>
            {renderLines(block.replace(/^\n+|\n+$/g, ''))}
          </Text>
        )
      )}
    </View>
  );
}

function renderLines(block: string) {
  return block.split('\n').map((line, i, all) => {
    const bullet = /^\s*[*-]\s+/.test(line);
    const content = bullet ? line.replace(/^\s*[*-]\s+/, '') : line;
    return (
      <Fragment key={i}>
        {bullet ? '•  ' : ''}
        {renderInline(content)}
        {i < all.length - 1 ? '\n' : ''}
      </Fragment>
    );
  });
}

function renderInline(line: string) {
  // Separa **negrita** y `código` sin perder el resto del texto
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((piece, i) => {
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      return (
        <Text key={i} style={styles.bold}>
          {piece.slice(2, -2)}
        </Text>
      );
    }
    if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      return (
        <Text key={i} style={styles.code}>
          {piece.slice(1, -1)}
        </Text>
      );
    }
    return piece;
  });
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  bold: { fontWeight: '700' },
  code: { fontFamily: 'Menlo', color: '#6ee7b7', fontSize: 14 },
  codeBlock: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: '#6ee7b7',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
  },
});
