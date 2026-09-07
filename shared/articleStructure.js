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
    const structuralHeadings = selectStructuralHeadings(lines, numberedMatters);
    lines.forEach((line, index) => {
        if (markdownDividerPattern.test(line.text)) {
            addDividerIfNeeded(blocks, "manual");
            sectionTexts = [];
            return;
        }
        const markdown = getMarkdownHeading(line.text);
        const type = markdown ? `h${markdown.level}` : index === 0 && isTitleLike(line, lines[index + 1])
            ? "h1" : isSubheadingLike(line, lines[index + 1]) ? "h2" : null;
        if (type) {
            addDividerIfNeeded(blocks, "auto", type === "h3");
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
        const structural = structuralHeadings.get(index);
        if (structural) {
            addDividerIfNeeded(blocks, "auto", true);
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
// Extract only a whole opening sentence; all offsets refer to the original line.
function extractHeadingCandidate(text, allowNumberedMatter) {
    const first = sentenceRanges(text)[0];
    if (!first?.complete) return null;
    const heading = text.slice(0, first.end).trim();
    if (lengthOf(heading) > 40 || /[？?]/.test(heading)) return null;
    const category = classifyHeading(heading, allowNumberedMatter);
    if (!category || lengthOf(heading) < (category.shortStep ? 5 : 8)) return null;
    return { heading, remainder: text.slice(first.end).trim(), end: first.end, ...category };
}

function classifyHeading(heading, allowNumberedMatter) {
    // Repeated practice rounds are details within a method, not new major sections.
    if (/^第[一二三四五六七八九十\d]+(?:遍|轮|次)/.test(heading)) return null;
    if (/^(?:我|他|她|昨天|今天|刚才|后来)/.test(heading)) return null;
    if (/^(?:首先|其次|再次|最后)[，,：:]?(?:我|他|她|大家)|^(?:开头|开场|中间部分|结尾|收尾)用[了过]/.test(heading)) return null;
    const action = /用|要|把|围绕|交代|选择|决定|明确|整理|完成|检查|核对|确认|准备|判断|练|换|做|看|留下|记录|投递/;
    const position = /^(?:开头|开场|中间(?:部分)?|结尾|收尾)(?:用|要|不要|别|把|围绕|先|只|可以)/.test(heading);
    const dimension = /^(?:先|再|接着)看/.test(heading) ||
        /^还有(?:一个|一笔|一项|一种).{0,10}(?:账|成本|条件|问题|维度)[：:]/.test(heading);
    const transition = /^(?:接下来|下一步|然后)(?:才是|是|要|需要|开始|再)/.test(heading);
    const stage = /^.{2,12}(?:写完|做完|结束|建立|完成|整理)(?:以后|之后|后)[，,]/.test(heading) ||
        /^(?:决定(?:去|参加|报名|投递|出发)|回来|返回|收到通知)(?:以后|之后|后)[，,]/.test(heading) ||
        /^如果(?:决定|选择)(?:不|放弃).{1,12}[，,]/.test(heading);
    const timing = /^.{2,12}(?:前|之前)(?:最好|先|要|需要|应当|应该|[，,])/.test(heading) ||
        /^每隔[一二三四五六七八九十两到至\d]+(?:天|周|次)[，,]/.test(heading);
    const comparison = /^.{2,12}是(?:另一个|另一项|另一种).{0,8}(?:卡点|难点|重点|问题|成本)/.test(heading) ||
        /^第[一二三四五六七八九十\d]+(?:科|类|项|组|部分)(?:不是|则|要|需要|是|以|用)/.test(heading);
    const strategy = /^优先(?:把|处理|解决|完成|检查|补|救)/.test(heading) ||
        /^.{2,12}(?:至少|最好|也不要).{0,16}(?:核[一二两三四五六七八九十\d]|检查|核对|确认|只设|只看)/.test(heading);
    const requirement = /^.{2,20}(?:每个|每一|所有).{1,8}(?:都要|必须).{2,16}(?:一致|核实|核对|确认|对应|检查)/.test(heading);
    if (position || dimension || comparison || strategy || ((transition || timing) && action.test(heading)))
        return { category: "major-step", priority: 10, shortStep: true };
    if ((stage && action.test(heading)) || requirement)
        return { category: "stage", priority: 9 };
    const numbered = allowNumberedMatter && numberedMatterOpeningPattern.test(heading);
    const method = /^(挑|选|找|留)(?:一|出)|^这时(?:可以|要|先)|^.{2,12}(?:也不必|不必立刻|可以先|需要先)|^你可以为.{2,12}(?:设|留|建立|准备)/.test(heading);
    const scope = /^普通.{2,12}也可以.{2,16}范围/.test(heading) || /^(真正|普通).{2,20}(?:范围|学校|目标).{0,12}(?:不需要|也可以|不必)/.test(heading);
    const conclusion = /^(所以|因此|总之)[，,]?(?:不要|别|不必)|^.{2,12}不是.{1,12}越.{1,12}越/.test(heading);
    if (/^(首先|其次|再次|最后[，,：:])/.test(heading) && !action.test(heading)) return null;
    if (numbered || structuralHeadingOpeningPattern.test(heading))
        return { category: "step", priority: 9 };
    if (method) return { category: "method", priority: 8 };
    if (scope || conclusion) return { category: "viewpoint", priority: 7 };
    return null;
}

function selectStructuralHeadings(lines, numberedMatters) {
    const explicitType = (line, index) => getMarkdownHeading(line.text) ||
        (index === 0 && isTitleLike(line, lines[index + 1])) || isSubheadingLike(line, lines[index + 1]);
    const extracted = lines.map((line, index) => !explicitType(line, index) && !isListLine(line.text) &&
        !markdownDividerPattern.test(line.text) ? extractHeadingCandidate(line.text, numberedMatters.has(line.text)) : null);
    const candidates = [];
    let offset = 0, group = 0;
    lines.forEach((line, index) => {
        if (explicitType(line, index)) { group += 1; return; }
        if (markdownDividerPattern.test(line.text)) return;
        const candidate = extracted[index];
        const hasBody = candidate && (isFollowingBody({ text: candidate.remainder }) ||
            (!candidate.remainder && isFollowingBody(lines[index + 1]) && !extracted[index + 1]));
        if (hasBody) candidates.push({ ...candidate, index, group, start: offset,
            bodyStart: offset + lengthOf(line.text.slice(0, candidate.end)) });
        offset += lengthOf(line.text);
    });
    const selected = [];
    // Select strongest section boundaries first, with deterministic reading-order ties.
    // Rejected candidate sentences remain in the body and count towards the 60-char gap.
    for (const candidate of candidates.sort((a, b) => b.priority - a.priority || a.index - b.index)) {
        const tooClose = selected.some(other => {
            if (other.group !== candidate.group) return false;
            const [before, after] = other.index < candidate.index ? [other, candidate] : [candidate, other];
            return after.start - before.bodyStart < 60;
        });
        if (!tooClose) selected.push(candidate);
    }
    return new Map(selected.map(candidate => [candidate.index, candidate]));
}
function splitIntoInfoBlocks(text) {
    const units = sentenceRanges(text).flatMap((range) => {
        const sentence = text.slice(range.start, range.end);
        return lengthOf(sentence) > 80 ? boundaryRanges(sentence, true).map((part) => ({
            start: range.start + part.start, end: range.start + part.end,
        })) : [range];
    });
    const blocks = [];
    let current = null, count = 0;
    for (const unit of units) {
        if (!current) { current = { ...unit }; count = 1; continue; }
        const currentLength = lengthOf(text.slice(current.start, current.end));
        const combinedLength = lengthOf(text.slice(current.start, unit.end));
        const standalone = currentLength >= 12 && emphasisScore(text.slice(current.start, current.end))?.score >= 9;
        if (!standalone && count < 2 && (combinedLength <= 65 || (currentLength < 20 && combinedLength <= 80))) {
            current.end = unit.end; count += 1;
        } else { blocks.push(current); current = { ...unit }; count = 1; }
    }
    if (current) blocks.push(current);
    if (blocks.length > 1) {
        const last = blocks[blocks.length - 1], previous = blocks[blocks.length - 2];
        if (lengthOf(text.slice(last.start, last.end)) <= 10 && lengthOf(text.slice(previous.start, last.end)) <= 80) {
            previous.end = last.end;
            blocks.pop();
        }
    }
    return blocks.map(({ start, end }) => text.slice(start, end).trim()).filter(Boolean);
}

function emphasisScore(text) {
    const clean = text.replace(/能不能|要不要|需不需要/g, "");
    if (/[？?]/.test(clean)) return null;
    const risk = /(?:^|[，,：:])(?:(?:就)?不要|(?:就)?别(?:再|只|急|为了|停|把|让)|不能|不应|避免|必须|务必|千万别|注意(?!力)|警惕)|一定要|不等于|不代表|误认为|不该|否则|超出承受|容易把|最没用/.test(clean);
    const contrast = /不是.{1,30}而是|不是.{1,30}只是|不在.{1,20}而在|不只是|不总是|并不总是|不必.{1,20}但/.test(clean);
    const conclusion = /关键(?:是|在于)|核心(?:是|在于)|结论是|至少要(?:建立|明确|确定)|值得.{0,18}但不适合|真正要调整|才是(?:结构|关键|核心|目标|解决)|才看得见|才看得清|就比|会比|说明|意味着|只要.{2,24}就|不是同一件事|逐字稿.{0,6}压缩|每一步.{0,10}判断/.test(clean);
    const goal = /(?:目标|目的)(?:是|不是).{3,}/.test(clean) && !/^(?:我|他|她|昨天|今天)/.test(clean);
    const relationship = /越.{2,24}[，,].{0,12}越.{2,24}/.test(clean) &&
        /明确|具体|清楚|真实|准备|判断|目标|材料|表达|问题|信息|边界/.test(clean);
    const requirement = /(?:只需要|只要|必须|务必|一定要)(?:保证|确认|检查|核对)|(?:每个|每一|所有).{1,12}(?:都要|必须).{2,}/.test(clean);
    const action = /(?:^|[，,：:])(?:把|先|再|用|让|问得|一次只|每次)|建议|具体做法|方法是|核对|检查|确认|主问题|问题链|提前整理/.test(clean);
    if (contrast || conclusion || goal || relationship) return { score: 10, style: "highlight" };
    if (risk || requirement) return { score: 9, style: "underline" };
    if (action && /建议|具体|先|再|需要|要|把|每次|一次/.test(clean)) return { score: 7, style: "color" };
    return null;
}
export function applyRuleBasedEmphasis(blocks) {
    // Preserve explicit manual styles if this helper is reapplied to edited blocks.
    const result = blocks.map((block) => ({ ...block }));
    const candidates = [];
    let offset = 0;
    for (let index = 0; index < result.length; index += 1) {
        const block = result[index];
        if (block.type !== "p") continue;
        const startOffset = offset;
        offset += lengthOf(block.text);
        if (block.highlight || block.underline || block.segments?.some(s => s.color || s.bold || s.highlight || s.underline)) continue;
        const ranges = sentenceRanges(block.text).flatMap((range) => {
            const sentence = block.text.slice(range.start, range.end);
            if (lengthOf(sentence) <= 80) return [range];
            return boundaryRanges(sentence, true).map((part) => ({ start: range.start + part.start, end: range.start + part.end }));
        });
        for (const range of ranges) {
            const text = block.text.slice(range.start, range.end);
            const length = lengthOf(text);
            const score = emphasisScore(text.trim());
            if (length >= 8 && length <= 80 && !/[、：:]$|的[，,]?$/.test(text.trim()) && score) candidates.push({ ...range, ...score, length, index,
                zone: Math.floor((startOffset + lengthOf(block.text.slice(0, range.start))) / 240) });
        }
    }
    const budget = Math.floor(offset * 0.3);
    const chosen = new Set();
    let used = 0;
    const zones = new Map();
    candidates.sort((a, b) => b.score - a.score || a.index - b.index || a.start - b.start);
    for (const candidate of candidates) {
        if (!zones.has(candidate.zone)) zones.set(candidate.zone, []);
        zones.get(candidate.zone).push(candidate);
    }
    const colors = new Set();
    // Round-robin by reading position, so the beginning cannot spend the whole budget.
    for (let round = 0; round < 3; round += 1) {
        for (const zone of [...zones.keys()].sort((a, b) => a - b)) {
            const candidate = zones.get(zone).find(c => !chosen.has(c.index) && used + c.length <= budget &&
                (c.style !== "color" || !colors.has(zone)));
            if (!candidate) continue;
            const block = result[candidate.index];
            const style = candidate.style === "color" ? { color: "blue" } : { [candidate.style]: true };
            block.segments = normalizeTextSegments([
                { text: block.text.slice(0, candidate.start) },
                { text: block.text.slice(candidate.start, candidate.end), ...style },
                { text: block.text.slice(candidate.end) },
            ]);
            chosen.add(candidate.index);
            used += candidate.length;
            if (candidate.style === "color") colors.add(zone);
        }
    }
    return result;
}
function addDividerIfNeeded(blocks, dividerSource = "auto", allowLeading = false) {
    const previous = blocks[blocks.length - 1];
    if (previous?.type === "hr") {
        if (dividerSource === "manual") previous.dividerSource = "manual";
    } else if (previous || allowLeading) blocks.push({ ...makeBlock("hr"), dividerSource });
}
function compactDividers(blocks) {
    const result = [];
    for (const [index, block] of blocks.entries()) {
        if (block.type !== "hr" || ((result.length || blocks[index + 1]?.type === "h3") && result[result.length - 1]?.type !== "hr")) result.push(block);
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
        color: !segment.highlight && !segment.underline && (segment.color === "red" || segment.color === "blue") ? segment.color : undefined,
        highlight: segment.highlight || undefined,
        underline: !segment.highlight && segment.underline || undefined,
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
    return segments.map(segment => renderSegmentMarkdown(block.highlight || block.underline
        ? { text: segment.text } : segment)).join("");
}
function renderSegmentMarkdown(segment) {
    let text = escapeInlineMarkdown(segment.text);
    if (segment.bold)
        text = `**${text}**`;
    if (segment.highlight) text = `<mark>${text}</mark>`;
    if (segment.underline) text = `<span style="${redUnderlineStyle}">${text}</span>`;
    if (segment.color)
        text = `<span style="${inlineColorStyles[segment.color]}">${text}</span>`;
    return text;
}
function mergeAdjacentSegments(segments) {
    return segments.reduce((result, segment) => {
        const previous = result[result.length - 1];
        if (previous && previous.bold === segment.bold && previous.color === segment.color && previous.highlight === segment.highlight && previous.underline === segment.underline) {
            previous.text += segment.text;
            return result;
        }
        result.push({ ...segment });
        return result;
    }, []);
}
