<script setup lang="ts">
import { computed, ref } from "vue";

/**
 * Text from character `start` of line `from` up to, not including, character
 * `end` of line `to`. Lines count from 1, characters from 0. Without `start`
 * and `end`, the whole lines.
 */
export interface TextRange {
  from: number;
  to: number;
  start?: number;
  end?: number;
}

/**
 * A file's source, documentation or code, as plain text with line numbers, so
 * no HTML from a repository reaches the page. Text in `highlights` is shaded
 * yellow, and text in `comments` green.
 *
 * With `selectable`, dragging the mouse over text selects exactly that text,
 * and clicking a line selects the line (shift-click another to extend it);
 * `select` is emitted with the range, always with `start` and `end`.
 */
const props = withDefaults(
  defineProps<{
    text: string;
    highlights?: TextRange[];
    comments?: TextRange[];
    selectable?: boolean;
    selection?: TextRange | null;
  }>(),
  { highlights: () => [], comments: () => [], selectable: false, selection: null },
);
const emit = defineEmits<{ select: [range: Required<TextRange>] }>();

const lines = computed(() => {
  const all = props.text.split("\n");
  // A file ending in a newline has no empty last line.
  if (all.length > 1 && all[all.length - 1] === "") all.pop();
  return all;
});

type Kind = "highlighted" | "commented" | "selected";

/** The characters of `line` a range covers, or null when it does not reach the line. */
function covered(range: TextRange, line: number, length: number): [number, number] | null {
  if (line < range.from || line > range.to) return null;
  const start = line === range.from ? (range.start ?? 0) : 0;
  const end = line === range.to ? (range.end ?? length) : length;
  return [Math.min(start, length), Math.min(end, length)];
}

/**
 * Each line, split into pieces wherever a range starts or ends on it. Ranges of
 * whole lines shade the whole row, so blank lines in them show too.
 */
const rows = computed(() => {
  const ranges: [Kind, TextRange][] = [
    ...props.highlights.map((range): [Kind, TextRange] => ["highlighted", range]),
    ...props.comments.map((range): [Kind, TextRange] => ["commented", range]),
    ...(props.selection ? [["selected", props.selection] as [Kind, TextRange]] : []),
  ];
  return lines.value.map((content, index) => {
    const line = index + 1;
    const whole = new Set<Kind>();
    const parts: [Kind, number, number][] = [];
    for (const [kind, range] of ranges) {
      const part = covered(range, line, content.length);
      if (!part) continue;
      if (range.start === undefined) whole.add(kind);
      else if (part[0] < part[1]) parts.push([kind, part[0], part[1]]);
    }
    const cuts = [...new Set([0, content.length, ...parts.flatMap(([, start, end]) => [start, end])])].sort((a, b) => a - b);
    const pieces = cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1];
      return { text: content.slice(start, end), kinds: parts.filter(([, s, e]) => s <= start && end <= e).map(([kind]) => kind) };
    });
    return { line, whole: [...whole], pieces };
  });
});

const root = ref<HTMLElement | null>(null);
/** The line the last click picked, which a shift-click extends from. */
const anchor = ref<number | null>(null);

/** Where `node` at `offset` is, as a line and a character in it, if it is inside this view. */
function position(node: Node | null, offset: number): { line: number; column: number } | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  const row = element?.closest<HTMLElement>("[data-line]");
  if (!row || !root.value?.contains(row)) return null;
  const line = Number(row.dataset.line);
  const length = lines.value[line - 1].length;
  const content = row.querySelector(".content")!;
  if (content.contains(node)) {
    const before = document.createRange();
    before.selectNodeContents(content);
    before.setEnd(node, offset);
    return { line, column: before.toString().length };
  }
  if (row.querySelector(".number")!.contains(node)) return { line, column: 0 };
  // On the row itself: before its text, or past its end.
  const next = node === row ? row.childNodes[offset] : null;
  return { line, column: next && (next === content || row.querySelector(".number") === next) ? 0 : length };
}

function lineOf(node: Node | null): number | null {
  return position(node, 0)?.line ?? null;
}

/** After a drag, the selected text becomes the selection; a click picks its line. */
function release(event: MouseEvent) {
  if (!props.selectable) return;
  const selected = window.getSelection();
  if (selected && !selected.isCollapsed && selected.rangeCount > 0) {
    const range = selected.getRangeAt(0);
    const first = position(range.startContainer, range.startOffset);
    const last = position(range.endContainer, range.endOffset);
    if (first && last && (first.line < last.line || first.column < last.column)) {
      anchor.value = first.line;
      emit("select", { from: first.line, to: last.line, start: first.column, end: last.column });
      // The view shades the selection itself.
      selected.removeAllRanges();
      return;
    }
  }
  const line = lineOf(event.target as Node);
  if (line === null) return;
  if (event.shiftKey && anchor.value !== null) {
    const [from, to] = [Math.min(anchor.value, line), Math.max(anchor.value, line)];
    emit("select", { from, to, start: 0, end: lines.value[to - 1].length });
    return;
  }
  anchor.value = line;
  emit("select", { from: line, to: line, start: 0, end: lines.value[line - 1].length });
}
</script>

<template>
  <div ref="root" class="source" :class="{ selectable }" @mouseup="release">
    <div v-for="row in rows" :key="row.line" class="line" :class="row.whole" :data-line="row.line">
      <span class="number">{{ row.line }}</span>
      <span class="content"><span v-for="(piece, index) in row.pieces" :key="index" :class="piece.kinds">{{ piece.text }}</span></span>
    </div>
  </div>
</template>

<style scoped>
.source {
  max-height: 70vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.line {
  display: flex;
}

.selectable .line {
  cursor: text;
}

.selectable .line:hover {
  background: var(--accent-soft);
}

/* Line numbers are not part of the text a drag selects. */
.number {
  flex: none;
  width: 3.5em;
  padding-right: 10px;
  color: var(--ink-faint);
  text-align: right;
  user-select: none;
}

.content {
  flex: 1;
  padding-right: 10px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Later rules win, so a comment shows over a highlight, and the selection over both. */
.highlighted {
  background: #fef3c7;
}

.content .highlighted {
  background: #fde68a;
}

.commented {
  background: #dcfce7;
}

.content .commented {
  background: #bbf7d0;
  border-bottom: 2px solid #16a34a;
}

.selected,
.selectable .selected:hover,
.content .selected {
  background: #bfdbfe;
}
</style>
