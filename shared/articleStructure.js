// Deterministic, browser-only layout. No network access or generated wording.
const markdownDividerPattern = /^-{3,}$/;
const bulletPattern = /^(?:[-*+]\s+|[•●▪]\s*)/;
const numberedPattern = /^(?:[一二三四五六七八九十百]+[、.．]|第[一二三四五六七八九十\d]+[步章节]|\d+[、．]|\d+\.(?!\d)|[（(]?[一二三四五六七八九十\d]+[）)])\s*/;
const numberedMatterOpeningPattern = /^(?:提前准备的)?第([一二三四五六七八九十\d]+)件事[，,:：]/;
const structuralHeadingOpeningPattern = /^(先说|先(?:别|不要|把|从|查|确认|明确|确定)|接着(?:把|从|查)|再(?:把|查|确认)|先看|再看|接着看|然后才是|首先|其次|再次|最后(?:再)?看|最后(?:是|，|,|：|:)|第[一二三四五六七八九十\d]+笔账(?:是|：|:)|第[一二三四五六七八九十\d]+周可以从|资料选择(?:也)?要|计划不要|到了周末)/;
const sectionPivotPattern = /^(如果你(?:现在|目前|暂时)?还(?:拿不准|没想好|不确定)|如果你只是|如果[一二三四五六七八九十几\d]+(?:周|天|个月)下来|第[一二三四五六七八九十\d]+周结束时|说到底|归根结底|总的来说|最后想说|最后要说)/;
const sectionAdvicePattern = /^(?:真正(?:要|需要)|关键(?:是|在于)|核心(?:是|在于)|具体做法|具体来说|接下来(?:要|需要)|下一步(?:是|要)|另一方面|反过来)/;
const redUnderlineStyle = "text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #d93025; text-decoration-thickness: 1.5px; text-underline-offset: 4px;";
const inlineColorStyles = { red: "color: #d93025;", blue: "color: #1677ff;" };
const visible = (text) => text.replace(/\s/g, "");
const lengthOf = (text) => Array.from(visible(text)).length;

export const sampleArticle = `小红书图文排版，先让读者愿意停下来

很多图文内容不是输在观点，而是输在阅读节奏。标题要明确，第一屏要有抓手，段落之间要给眼睛一点休息。

结构先行
先把文章拆成几个部分，每一部分只解决一个问题。这样读者滑动图片时，会感觉自己一直在获得信息。

重点句要少而准。真正有价值的结论、方法和数字，适合用黄色高亮提示。

注意不要把所有句子都标重点。高亮太多会让页面失去层次，也会降低读者的信任感。

发布前检查
一定要检查每一页是否有文字截断，标题是否醒目，提醒句是否足够清楚。`;

export function createBlocksFromText(input) {
    return formatArticle(input).blocks;
}

export function formatArticle(input) {
    if (!input.trim()) return { blocks: [] };
    return validateLayoutResult(buildLocalBlocks(input), input);
}

// Compare against raw source lines, independently of the structure classifier.
export function layoutPreservesSource(blocks, source) {
    const expected = rawLines(source).filter((line) => !markdownDividerPattern.test(line))
        .map((line) => getMarkdownHeading(line)?.text ?? line).join("");
    return Array.isArray(blocks) && blocks.every((block) => typeof block.text === "string" &&
        (!block.segments || textFromSegments(block.segments) === block.text)) &&
        visible(expected) === visible(blocks.filter((block) => block.type !== "hr").map((block) => block.text).join(""));
}

export function validateLayoutResult(blocks, source) {
    if (layoutPreservesSource(blocks, source)) return { blocks };
    const original = rawLines(source).filter(Boolean).map((line) => {
        if (markdownDividerPattern.test(line)) return makeBlock("hr");
        const heading = getMarkdownHeading(line);
        return makeBlock(heading ? `h${heading.level}` : "p", heading?.text ?? line);
    });
    return { blocks: compactDividers(original), notice: "排版校验未通过，已保留原段落，可继续手工编辑。" };
}

function buildLocalBlocks(input) {
    const lines = getTextLines(input);
    const blocks = [];
    let sectionTexts = [];
    const numberedMatters = getOrderedNumberedMatterHeadingLines(lines);
    lines.forEach((line, index) => {
        if (markdownDividerPattern.test(line.text)) {
            addDividerIfNeeded(blocks);
            sectionTexts = [];
            return;
        }
        const markdown = getMarkdownHeading(line.text);
        const type = markdown ? `h${markdown.level}` : index === 0 && isTitleLike(line, lines[index + 1])
            ? "h1" : isSubheadingLike(line, lines[index + 1]) ? "h2" : null;
        if (type) {
            addDividerIfNeeded(blocks);
            blocks.push(makeBlock(type, markdown?.text ?? line.text));
            sectionTexts = [];
            return;
        }
        if (blocks[blocks.length - 1]?.type === "h1") addDividerIfNeeded(blocks);
        if (isListLine(line.text)) {
            blocks.push(makeBlock("p", line.text));
            sectionTexts.push(line.text);
            return;
        }
        const structural = splitLeadingStructuralHeading(line.text, numberedMatters.has(line.text));
        if (structural && (structural.remainder || isFollowingBody(lines[index + 1]))) {
            addDividerIfNeeded(blocks);
            blocks.push(makeBlock("h3", structural.heading));
            sectionTexts = [];
            if (structural.remainder) {
                splitIntoInfoBlocks(structural.remainder).forEach((text) => blocks.push(makeBlock("p", text)));
                sectionTexts.push(structural.remainder);
            }
            return;
        }
        const enoughContext = sectionTexts.length >= 2 || lengthOf(sectionTexts.join("")) >= 180;
        if (line.hasParagraphBefore && enoughContext &&
            (sectionPivotPattern.test(line.text) || sectionAdvicePattern.test(line.text) ||
             (/^(所以|因此|总之)/.test(line.text) && /没有|不要|需要|别|不等于|应该/.test(line.text.split("。")[0])))) {
            addDividerIfNeeded(blocks);
            sectionTexts = [];
        }
        splitIntoInfoBlocks(line.text).forEach((text) => blocks.push(makeBlock("p", text)));
        sectionTexts.push(line.text);
    });
    return applyRuleBasedEmphasis(compactDividers(blocks));
}

function rawLines(input) {
    return input.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
}
function getMarkdownHeading(text) {
    const match = /^(#{1,3})\s+(.+)$/.exec(text);
    return match ? { level: match[1].length, text: match[2].trim() } : null;
}
function isListLine(text) {
    return bulletPattern.test(text) || numberedPattern.test(text);
}
function isFollowingBody(line) {
    return line && !isListLine(line.text) && !getMarkdownHeading(line.text) &&
        !markdownDividerPattern.test(line.text) && (lengthOf(line.text) > 22 || /[。！？!?]/.test(line.text));
}
function isTitleLike(line, next) {
    if (isListLine(line.text) || lengthOf(line.text) > 40 || /[。；;，,：:]$/.test(line.text)) return false;
    if (sentenceRanges(line.text).length > 1) return false;
    return line.hasBlankAfter || !next || isFollowingBody(next) ||
        (lengthOf(line.text) <= 16 && !/[，,:：]/.test(line.text) && !/^(我|你|他|她|它|这|那|今天|最近|因为|如果)/.test(line.text));
}
function isSubheadingLike(line, next) {
    if (!line || line.isNumberedListItem || bulletPattern.test(line.text) || getMarkdownHeading(line.text) ||
        lengthOf(line.text) > 22 || /[。！？!?；;，,]$/.test(line.text) || !isFollowingBody(next)) return false;
    if (numberedPattern.test(line.text)) return true;
    // A noun-like label plus a following body is evidence; shortness alone isn't.
    return (line.hasBlankBefore || line.hasBlankAfter) &&
        /(检查|准备|清单|步骤|方法|原则|误区|总结|结构|选择|安排|条件|流程|成本|建议|注意事项)$/.test(line.text);
}
function hasCompleteLineEnding(text) {
    return /(?:[。！？!?][”’」』"'）)]*|[”’」』"])$/.test(text.trim());
}
function getTextLines(input) {
    const raw = rawLines(input);
    const nonEmpty = raw.flatMap((text, index) => text ? [{ text,
        hasBlankBefore: index === 0 || !raw[index - 1],
        hasBlankAfter: index === raw.length - 1 || !raw[index + 1],
        hasParagraphBefore: index === 0 || !raw[index - 1] || hasCompleteLineEnding(raw[index - 1]),
        hasParagraphAfter: index === raw.length - 1 || !raw[index + 1] || hasCompleteLineEnding(text),
    }] : []);
    nonEmpty.forEach((line, index) => {
        line.isNumberedListItem = numberedPattern.test(line.text) &&
            (numberedPattern.test(nonEmpty[index - 1]?.text ?? "") || numberedPattern.test(nonEmpty[index + 1]?.text ?? ""));
    });
    const lines = [];
    let pending = [];
    const flush = () => {
        if (!pending.length) return;
        lines.push({ ...pending[0], text: joinSoftWrappedLines(pending.map((line) => line.text)),
            hasBlankAfter: pending[pending.length - 1].hasBlankAfter, hasParagraphAfter: pending[pending.length - 1].hasParagraphAfter });
        pending = [];
    };
    nonEmpty.forEach((line, index) => {
        const ownLine = markdownDividerPattern.test(line.text) || getMarkdownHeading(line.text) ||
            isListLine(line.text) || isSubheadingLike(line, nonEmpty[index + 1]) ||
            (index === 0 && isTitleLike(line, nonEmpty[index + 1]));
        if (line.hasBlankBefore || ownLine) flush();
        if (ownLine) lines.push(line);
        else {
            pending.push(line);
            if (line.hasParagraphAfter) flush();
        }
    });
    flush();
    return lines;
}
function joinSoftWrappedLines(lines) {
    return lines.reduce((result, line) => {
        const needsSpace = /[A-Za-z0-9)]$/.test(result) && /^[A-Za-z0-9(]/.test(line);
        return result + (needsSpace ? " " : "") + line;
    }, "");
}

// Offsets are UTF-16 slices of the source. Never split within quotes, brackets,
// decimal numbers or URLs; consume closing punctuation with its sentence.
function boundaryRanges(text, soft = false) {
    const pairs = { "“": "”", "‘": "’", "「": "」", "『": "』", "（": "）", "(": ")", "【": "】", "[": "]", '"': '"' };
    const stack = [];
    const ranges = [];
    let start = 0;
    const links = [...text.matchAll(/https?:\/\/[^\s，。；！？“”「」<>]+/g)];
    let linkIndex = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (links[linkIndex]?.index === i) {
            i += links[linkIndex][0].length - 1;
            linkIndex += 1;
            continue;
        }
        const char = text[i];
        if (stack.length && char === stack[stack.length - 1]) { stack.pop(); continue; }
        if (pairs[char]) { stack.push(pairs[char]); continue; }
        if (!(soft ? /[，,：:；;、]/ : /[。！？!?]/).test(char)) continue;
        let end = i + 1;
        if (!soft) while (/[。！？!?]/.test(text[end] ?? "") && end < text.length) end += 1;
        if (stack.length) {
            if (soft) continue;
            let depth = stack.length;
            while (depth && text[end] === stack[depth - 1]) { depth -= 1; end += 1; }
            if (depth || /[，,：:；;、]/.test(text[end] ?? "")) continue;
            // Inline quoted phrases belong to their containing sentence.
            const prefix = text.slice(start, i);
            if (!/^(?:[^“「『"]*(?:说|问|回答|提醒|强调)[：:]?|[“「『"])/.test(prefix)) continue;
            stack.length = 0;
        }
        if (soft && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;
        ranges.push({ start, end, complete: !soft });
        start = end;
        i = end - 1;
    }
    if (start < text.length) ranges.push({ start, end: text.length, complete: false });
    return ranges;
}
function sentenceRanges(text) { return boundaryRanges(text); }
function splitLeadingStructuralHeading(text, allowNumberedMatter) {
    const first = sentenceRanges(text)[0];
    if (!first?.complete) return null;
    const heading = text.slice(0, first.end).trim();
    const numbered = allowNumberedMatter && numberedMatterOpeningPattern.test(heading);
    if (lengthOf(heading) < 6 || lengthOf(heading) > (numbered ? 40 : 34) ||
        /[？?]/.test(heading) || (!numbered && !structuralHeadingOpeningPattern.test(heading))) return null;
    if (/^(首先|其次|再次|最后[，,：:])/.test(heading) &&
        !/(要|需要|把|核对|检查|准备|确认|选择|决定|明确|目标|判断|整理|完成)/.test(heading)) return null;
    return { heading, remainder: text.slice(first.end).trim() };
}
function splitIntoInfoBlocks(text) {
    const units = sentenceRanges(text).flatMap((range) => {
        const sentence = text.slice(range.start, range.end);
        return lengthOf(sentence) > 100 ? boundaryRanges(sentence, true).map((part) => ({
            start: range.start + part.start, end: range.start + part.end,
        })) : [range];
    });
    const blocks = [];
    let current = null;
    for (const unit of units) {
        if (!current) { current = { ...unit }; continue; }
        const currentLength = lengthOf(text.slice(current.start, current.end));
        const combinedLength = lengthOf(text.slice(current.start, unit.end));
        if (combinedLength <= 100 || (currentLength < 50 && combinedLength <= 120)) current.end = unit.end;
        else { blocks.push(current); current = { ...unit }; }
    }
    if (current) blocks.push(current);
    if (blocks.length > 1) {
        const last = blocks[blocks.length - 1], previous = blocks[blocks.length - 2];
        if (lengthOf(text.slice(last.start, last.end)) <= 10 && lengthOf(text.slice(previous.start, last.end)) <= 120) {
            previous.end = last.end;
            blocks.pop();
        }
    }
    return blocks.map(({ start, end }) => text.slice(start, end).trim()).filter(Boolean);
}

function emphasisScore(text) {
    const clean = text.replace(/能不能|要不要|需不需要/g, "");
    if (/[？?]/.test(clean)) return null;
    const risk = /(?:^|[，,：:])(不要|不能|不应|避免|必须|务必|千万别|注意|警惕|别把)|一定要|不等于|不代表/.test(clean);
    const action = /建议|具体做法|方法是|先把|先做|先查|先确认|先判断|再决定|再检查|核对|检查|确认/.test(clean);
    const conclusion = /关键(?:是|在于)|核心(?:是|在于)|结论是|值得.{0,18}但不适合|不是.{1,24}而是|真正要调整/.test(clean);
    if (risk) return { score: 8 + (action ? 1 : 0), color: "red" };
    if (conclusion) return { score: 9, color: "blue" };
    if (action && /建议|具体|先|再|需要|要/.test(clean)) return { score: 7, color: "blue" };
    return null;
}
export function applyRuleBasedEmphasis(blocks) {
    const result = blocks.map((block) => ({ ...block, segments: undefined, highlight: false, underline: false }));
    const candidates = [];
    let section = 0;
    for (let index = 0; index < result.length; index += 1) {
        const block = result[index];
        if (block.type === "hr") { section += 1; continue; }
        if (block.type !== "p") continue;
        const ranges = sentenceRanges(block.text).flatMap((range) => {
            const sentence = block.text.slice(range.start, range.end);
            if (lengthOf(sentence) <= 60) return [range];
            return boundaryRanges(sentence, true).map((part) => ({ start: range.start + part.start, end: range.start + part.end }));
        });
        for (const range of ranges) {
            const text = block.text.slice(range.start, range.end);
            const length = lengthOf(text);
            const score = emphasisScore(text.trim());
            if (length >= 8 && length <= 60 && score) candidates.push({ ...range, ...score, length, index, section });
        }
    }
    const budget = Math.floor(result.filter((block) => block.type === "p").reduce((sum, block) => sum + lengthOf(block.text), 0) * 0.2);
    const perSection = new Map(), selected = new Set();
    let used = 0;
    candidates.sort((a, b) => b.score - a.score || a.index - b.index || a.start - b.start);
    for (const candidate of candidates) {
        if (selected.size >= 6) break;
        if (selected.has(candidate.index) || (perSection.get(candidate.section) ?? 0) >= 2 || used + candidate.length > budget) continue;
        const block = result[candidate.index];
        // One treatment only: inline color, without bold/mark/underline stacking.
        block.segments = normalizeTextSegments([
            { text: block.text.slice(0, candidate.start) },
            { text: block.text.slice(candidate.start, candidate.end), color: candidate.color },
            { text: block.text.slice(candidate.end) },
        ]);
        selected.add(candidate.index);
        used += candidate.length;
        perSection.set(candidate.section, (perSection.get(candidate.section) ?? 0) + 1);
    }
    return result;
}
function addDividerIfNeeded(blocks) {
    if (blocks.length && blocks[blocks.length - 1].type !== "hr") blocks.push(makeBlock("hr"));
}
function compactDividers(blocks) {
    const result = [];
    for (const block of blocks) {
        if (block.type !== "hr" || (result.length && result[result.length - 1].type !== "hr")) result.push(block);
    }
    if (result[result.length - 1]?.type === "hr") result.pop();
    return result;
}

function getOrderedNumberedMatterHeadingLines(lines) {
    const candidates = lines
        .slice(1)
        .map((line) => ({ line: line.text, ordinal: getNumberedMatterOrdinal(line.text) }))
        .filter((candidate) => candidate.ordinal !== null);
    const approvedLines = new Set();
    let run = [];
    const approveRun = () => {
        if (run.length >= 2)
            run.forEach((candidate) => approvedLines.add(candidate.line));
    };
    candidates.forEach((candidate) => {
        if (!run.length || candidate.ordinal === run[run.length - 1].ordinal + 1) {
            run.push(candidate);
            return;
        }
        approveRun();
        run = [candidate];
    });
    approveRun();
    return approvedLines;
}
function getNumberedMatterOrdinal(text) {
    const match = numberedMatterOpeningPattern.exec(text);
    if (!match)
        return null;
    if (/^\d+$/.test(match[1])) {
        const value = Number(match[1]);
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    const digitValues = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
    };
    return digitValues[match[1]] ?? null;
}

export function blocksToMarkdown(blocks) {
    return blocks
        .map((block) => {
        if (block.type === "hr")
            return "---";
        let text = renderInlineMarkdown(block);
        if (block.highlight)
            text = `<mark>${text}</mark>`;
        if (block.underline) {
            text = `<span style="${redUnderlineStyle}">${text}</span>`;
        }
        if (block.type === "h1")
            return `# ${text}`;
        if (block.type === "h2")
            return `## ${text}`;
        if (block.type === "h3")
            return `### ${text}`;
        return text;
    })
        .join("\n\n");
}
export function makeBlock(type, text = "", highlight = false, underline = false, segments) {
    const normalizedSegments = normalizeTextSegments(segments);
    const normalizedText = normalizedSegments ? textFromSegments(normalizedSegments) : text;
    return {
        type,
        text: normalizedText,
        segments: normalizedSegments,
        highlight: type === "p" ? highlight : false,
        underline: type === "p" ? underline : false,
    };
}
export function normalizeTextSegments(segments) {
    if (!segments?.length)
        return undefined;
    const normalized = segments
        .map((segment) => ({
        text: segment.text,
        bold: segment.bold || undefined,
        color: segment.color === "red" || segment.color === "blue" ? segment.color : undefined,
    }))
        .filter((segment) => segment.text.length > 0);
    if (!normalized.length)
        return undefined;
    return mergeAdjacentSegments(normalized);
}
export function textFromSegments(segments) {
    return segments.map((segment) => segment.text).join("");
}

function escapeInlineMarkdown(text) {
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderInlineMarkdown(block) {
    const segments = normalizeTextSegments(block.segments);
    if (!segments)
        return escapeInlineMarkdown(block.text);
    return segments.map(renderSegmentMarkdown).join("");
}
function renderSegmentMarkdown(segment) {
    let text = escapeInlineMarkdown(segment.text);
    if (segment.bold)
        text = `**${text}**`;
    if (segment.color)
        text = `<span style="${inlineColorStyles[segment.color]}">${text}</span>`;
    return text;
}
function mergeAdjacentSegments(segments) {
    return segments.reduce((result, segment) => {
        const previous = result[result.length - 1];
        if (previous && previous.bold === segment.bold && previous.color === segment.color) {
            previous.text += segment.text;
            return result;
        }
        result.push({ ...segment });
        return result;
    }, []);
}
