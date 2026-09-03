const headingPattern = /^([一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[步章节]|[0-9]+[、.．]|\d+\s*[）)]|[-*]\s*)/;
const endPunctuation = /[。！？!?；;，,、：:]$/;
const highlightPattern = /(核心|关键|重点|结论|建议|原则|清单|公式|总结|一句话|真正|适合|值得|突破口|掌控感|排雷|提分|质的飞跃|前夜)/;
const underlinePattern = /(注意|提醒|不要|避免|一定|必须|记得|别忘|千万|尤其|小心|风险|误区|雷区|检查|确认|遗漏|截断|错误|失败|后果|失去|降低|变差|出错|失控)/;
const summaryPattern = /(^所以|^因此|^总之|^一句话|^最后|^简单说|^也就是说|才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/;
const markdownDividerPattern = /^-{3,}$/;
const redUnderlineStyle = "text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #d93025; text-decoration-thickness: 1.5px; text-underline-offset: 4px;";
const inlineColorStyles = {
    red: "color: #d93025;",
    blue: "color: #1677ff;",
};
const inlineColorCuePatterns = {
    red: /(注意|提醒|不要|避免|一定要|一定|必须|停止|正视|千万|尤其|小心|警惕|风险|误区|雷区|常见|错误|失败|后果|遗漏|截断|焦虑|粗心|瓶颈|恶性循环|自我否定|最可惜|最容易|降低|失去|变差|浪费|拖慢|出错|失控|检查|确认|排雷)/,
    blue: /(方法|步骤|方案|建议|做法|行动|执行|结论|总结|核心|关键|重点|原则|清单|公式|路径|策略|工具|流程|解决|完成|拆成|搭建|先把|然后|最后|所以|因此|总之|一句话|简单说|也就是说|真正|适合|值得|可以|就能|即可|提升|优化|改善|效果|效率|增长|转化|复盘|获得|抓手)/,
};
const inlineRedActionPattern = /^(注意|提醒|不要|不能|避免|一定|必须|千万|小心|警惕|别|停止|检查|确认)|一定要|必须要|不要把|不能把/;
const inlineBlueActionPattern = /^(先|再|然后|最后|把|用|让|给|从|只要|可以|建议|总的来说|总之|所以|因此|一句话|简单说|也就是说)|就能|即可|适合用|拆成|解决/;
const hardSentencePattern = /[^。！？!?；;]+[。！？!?；;]?/g;
const softClausePattern = /[^，,：:、]+[，,：:、]?/g;
const infoBlockMinLength = 24;
const infoBlockTargetMaxLength = 68;
const infoBlockForcedMaxLength = 86;
const infoBlockMaxUnits = 2;
const longSentenceSplitLength = 78;
const orphanInfoBlockMaxLength = 6;
const implicitSectionMinParagraphs = 2;
const implicitSectionMinChars = 180;
const implicitSectionOpeningPattern = /^(真正|关键|核心|重点|结论|建议|方法|做法|解决|接下来|下一步|所以|因此|总之|最后|一句话|简单说|也就是说|具体做法|具体来说|注意|提醒|不要|不能|避免|必须|一定要|首先|其次|第一|第二|第三|另外|另一方面|换句话说)/;
const implicitSectionPivotPattern = /^(如果你(?:现在|目前|暂时)?还(?:拿不准|没想好|不确定)|如果你只是|如果[一二三四五六七八九十几\d]+(?:周|天|个月)下来|第[一二三四五六七八九十\d]+周结束时|说到底|归根结底|总的来说|最后想说|最后要说)/;
const implicitSectionAdvicePattern = /(调整|判断|做法|方法|建议|解决|可以|应该|需要|先|再|步骤|原则|边界)/;
const implicitSectionScenePattern = /(家长|学生|同事|领导|孩子|老师|消息|任务|拜托|撒娇|委屈|情绪|状态|场景|问题)/;
const continuationOpeningPattern = /^(这些|这种|同时|也|还|而且|然后|后来|前面|刚开始|上面|这时候)/;
const structuralHeadingOpeningPattern = /^(先看|再看|接着看|然后才是|首先|其次|再次|最后(?:再)?看|最后(?:是|，|,|：|:)|第[一二三四五六七八九十\d]+笔账(?:是|：|:)|第[一二三四五六七八九十\d]+周可以从|资料选择(?:也)?要|计划不要|到了周末)/;
const numberedMatterOpeningPattern = /^(?:提前准备的)?第([一二三四五六七八九十\d]+)件事[，,:：]/;
const structuralHeadingMinLength = 6;
const structuralHeadingMaxLength = 34;
const numberedMatterHeadingMaxLength = 40;
const explicitStancePattern = /(我先说我的看法|我的看法是|我认为|我的结论是|值得.{0,24}但不适合|不是给.+统一.+而是)/;
const prohibitionPattern = /(^不能|不能(?:把|只|让|靠|等|将|用|因为|为了|完全|仅|说|有)|不应|不该)/;
const maxArticleHighlights = 3;
const maxArticleUnderlines = 3;
const maxInlineColorLength = 60;
const minInlineColorLength = 6;
const maxInlineColorRatio = 0.86;
const maxInlineColorSegmentsPerBlock = 1;
const maxInlineColorCharsPerBlock = 60;
const inlineColorScoreThreshold = 5;
export const sampleArticle = `小红书图文排版，先让读者愿意停下来

很多图文内容不是输在观点，而是输在阅读节奏。标题要明确，第一屏要有抓手，段落之间要给眼睛一点休息。

结构先行
先把文章拆成几个部分，每一部分只解决一个问题。这样读者滑动图片时，会感觉自己一直在获得信息。

重点句要少而准。真正有价值的结论、方法和数字，适合用黄色高亮提示。

注意不要把所有句子都标重点。高亮太多会让页面失去层次，也会降低读者的信任感。

发布前检查
一定要检查每一页是否有文字截断，标题是否醒目，提醒句是否足够清楚。`;
export function createBlocksFromText(input) {
    const lines = getTextLines(input);
    if (lines.length === 0) {
        return createBlocksFromText(sampleArticle);
    }
    const blocks = [];
    let hasTitle = false;
    let sectionParagraphTexts = [];
    const numberedMatterHeadingLines = getOrderedNumberedMatterHeadingLines(lines);
    const hasExplicitSections = lines.some((line, index) => {
        if (index === 0 || markdownDividerPattern.test(line.text))
            return false;
        const markdownHeading = getMarkdownHeading(line.text);
        return Boolean((markdownHeading && markdownHeading.level > 1) || isSubheadingLike(line));
    });
    const resetSectionStats = () => {
        sectionParagraphTexts = [];
    };
    lines.forEach((line, index) => {
        if (markdownDividerPattern.test(line.text)) {
            addDividerIfNeeded(blocks);
            resetSectionStats();
            return;
        }
        const markdownHeading = getMarkdownHeading(line.text);
        if (markdownHeading) {
            if (!hasTitle) {
                blocks.push(makeBlock("h1", markdownHeading.text));
                hasTitle = true;
                resetSectionStats();
                return;
            }
            addDividerAfterTitleIfNeeded(blocks);
            addDividerIfNeeded(blocks);
            blocks.push(makeBlock(markdownHeading.level === 3 ? "h3" : "h2", markdownHeading.text));
            resetSectionStats();
            return;
        }
        const isTitle = !hasTitle && (index === 0 || isTitleLike(line.text));
        const isHeading = !isTitle && isSubheadingLike(line);
        if (isTitle) {
            blocks.push(makeBlock("h1", cleanPrefix(line.text)));
            hasTitle = true;
            resetSectionStats();
            return;
        }
        addDividerAfterTitleIfNeeded(blocks);
        if (isHeading) {
            addDividerIfNeeded(blocks);
            blocks.push(makeBlock("h2", cleanPrefix(line.text)));
            resetSectionStats();
            return;
        }
        const structuralHeading = splitLeadingStructuralHeading(line.text, numberedMatterHeadingLines.has(line.text));
        if (structuralHeading) {
            addDividerIfNeeded(blocks);
            blocks.push(makeBlock("h3", structuralHeading.heading));
            resetSectionStats();
            if (structuralHeading.remainder) {
                splitIntoInfoBlocks(structuralHeading.remainder).forEach((paragraph) => {
                    blocks.push(makeBlock("p", paragraph, false, false, createRuleBasedSegments(paragraph, "p")));
                });
                sectionParagraphTexts.push(structuralHeading.remainder);
            }
            return;
        }
        if (shouldStartImplicitSection(blocks, hasExplicitSections, line, sectionParagraphTexts)) {
            addDividerIfNeeded(blocks);
            resetSectionStats();
        }
        splitIntoInfoBlocks(line.text).forEach((paragraph) => {
            blocks.push(makeBlock("p", paragraph, false, false, createRuleBasedSegments(paragraph, "p")));
        });
        sectionParagraphTexts.push(line.text);
    });
    if (!blocks.some((block) => block.type === "h1") && blocks[0]) {
        blocks[0] = { ...blocks[0], type: "h1", highlight: false, underline: false };
    }
    return applyRuleBasedEmphasis(compactDividers(blocks));
}
export function stabilizeAiDraftBlocks(blocks, sourceText) {
    const localBlocks = createBlocksFromText(sourceText);
    if (!draftPreservesSource(blocks, sourceText)) return localBlocks;
    const normalizedAiBlocks = compactDividers(blocks
        .map(prepareAiDraftBlock)
        .filter((block) => block.type === "hr" || block.text.trim().length > 0));
    const localStyleStream = createComparableStyleStream(localBlocks);
    const aiStyleStream = createComparableStyleStream(normalizedAiBlocks);
    if (!localStyleStream.text || localStyleStream.text !== aiStyleStream.text) {
        return localBlocks;
    }
    const mergedStyles = localStyleStream.styles.map((localStyle, index) => mergeCharacterStyles(localStyle, aiStyleStream.styles[index]));
    const structureBlocks = restoreSafeStructure(normalizedAiBlocks, localBlocks, sourceText);
    return applyRuleBasedEmphasis(applyComparableStyles(structureBlocks, mergedStyles, aiStyleStream.styles));
}

// Offsets count visible UTF-16 characters, excluding layout whitespace and
// Markdown markers. They therefore survive blank lines, soft wraps and emoji.
function visibleText(text) {
    return text.replace(/\s/g, "");
}

function completeSentenceRanges(text) {
    const ranges = [];
    const pairs = { "“": "”", "‘": "’", "「": "」", "『": "』", '"': '"' };
    const stack = [];
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (stack.length && char === stack[stack.length - 1].close) {
            stack.pop();
            continue;
        }
        if (pairs[char]) {
            stack.push({ close: pairs[char], direct: index === start || /[：:]$|(?:说|问|问道|说道|写道|回答|提醒|强调|表示)$/.test(text.slice(start, index).trim()) });
            continue;
        }
        // A semicolon joins clauses, not complete sentences. Punctuation inside
        // an inline quotation is not a safe place to start a heading.
        if (!/[。！？!?]/.test(char)) continue;
        let end = index + 1;
        while (end < text.length && /[。！？!?]/.test(text[end])) end += 1;
        if (stack.length) {
            let depth = stack.length;
            while (depth > 0 && text[end] === stack[depth - 1].close) {
                depth -= 1;
                end += 1;
            }
            if (depth !== 0 || !stack[0].direct) continue;
            stack.length = 0;
        }
        ranges.push({ start, end, complete: true });
        start = end;
        index = end - 1;
    }
    if (start < text.length) ranges.push({ start, end: text.length, complete: false });
    return ranges;
}

export function buildSentenceIndex(source) {
    const sentences = [];
    let offset = 0;
    let body = [];
    const push = (text, kind, complete) => {
        if (!visibleText(text)) return;
        const length = visibleText(text).length;
        sentences.push({ sentenceId: `s${sentences.length + 1}`, text, start: offset, end: offset + length, kind, complete });
        offset += length;
    };
    const flush = () => {
        const text = joinSoftWrappedLines(body);
        completeSentenceRanges(text).forEach((range) => push(text.slice(range.start, range.end).trim(), "body", range.complete));
        body = [];
    };
    getTextLines(source).forEach((line, index) => {
        const heading = getMarkdownHeading(line.text);
        if (markdownDividerPattern.test(line.text)) {
            flush();
        } else if (index === 0 || heading || isSubheadingLike(line)) {
            flush();
            push(heading?.text ?? cleanPrefix(line.text), "heading", false);
        } else {
            body.push(line.text);
        }
    });
    flush();
    return sentences;
}

function positionedBlocks(blocks) {
    let offset = 0;
    return blocks.map((block) => {
        const start = offset;
        if (block.type !== "hr") offset += visibleText(block.text).length;
        return { block, start, end: offset };
    });
}

export function draftPreservesSource(blocks, source) {
    if (!Array.isArray(blocks) || !blocks.length) return false;
    if (blocks.some((block) => typeof block?.text !== "string" ||
        (block.type !== "hr" && block.segments && textFromSegments(block.segments) !== block.text))) return false;
    const expected = buildSentenceIndex(source).map((sentence) => visibleText(sentence.text)).join("");
    return Boolean(expected) && expected === blocks.filter((block) => block.type !== "hr").map((block) => visibleText(block.text)).join("");
}

// Convert a visible-text boundary to a slice in the original block, retaining
// its punctuation, internal spaces and UTF-16 characters exactly.
function sourceSlice(text, start, end) {
    let offset = 0;
    let from = 0;
    let to = text.length;
    for (let index = 0; index < text.length; index += 1) {
        if (/\s/.test(text[index])) continue;
        if (offset === start) from = index;
        if (offset === end) { to = index; break; }
        offset += 1;
    }
    return text.slice(from, to).trim();
}

const unsafeHeading = /^(我先说|我认为|我觉得|我的看法|很多人|有些人|有人|如果|所以|因此|总之|为什么|是否)/;

export function applyStructureSuggestions(blocks, rawSuggestions, source, diagnostics = { accepted: 0, rejected: 0, reasons: {} }) {
    const reject = (reason) => {
        diagnostics.rejected += 1;
        diagnostics.reasons[reason] = (diagnostics.reasons[reason] ?? 0) + 1;
    };
    if (!draftPreservesSource(blocks, source)) {
        reject("text_mismatch");
        return createBlocksFromText(source);
    }
    if (!Array.isArray(rawSuggestions)) return blocks;
    const sentences = buildSentenceIndex(source);
    const byId = new Map(sentences.map((sentence) => [sentence.sentenceId, sentence]));
    const positioned = positionedBlocks(blocks);
    const approved = [];
    const seen = new Set();
    const counts = { h3: 0, section: 0 };
    for (const raw of rawSuggestions) {
        const sentence = byId.get(raw?.sentenceId);
        if (!sentence) { reject("invalid_sentence_id"); continue; }
        if (raw.action !== "h3" && raw.action !== "section") { reject("invalid_action"); continue; }
        if (seen.has(sentence.sentenceId)) { reject("duplicate"); continue; }
        if (sentence.kind !== "body" || !sentence.complete) { reject("not_complete_body_sentence"); continue; }
        const length = Array.from(visibleText(sentence.text)).length;
        if (length < 6 || length > 60) { reject("length"); continue; }
        if (raw.action === "h3" && (/[？?]/.test(sentence.text) || unsafeHeading.test(sentence.text))) {
            reject("not_heading"); continue;
        }
        const overlaps = positioned.filter((item) => item.end > sentence.start && item.start < sentence.end);
        const existing = overlaps.length === 1 && overlaps[0].block.type === "h3" &&
            overlaps[0].start === sentence.start && overlaps[0].end === sentence.end;
        if (overlaps.some((item) => item.block.type !== "p" && !existing) ||
            positioned.some((item) => item.block.type === "hr" && item.start > sentence.start && item.start < sentence.end)) {
            reject("protected_structure"); continue;
        }
        if (raw.action === "h3" && !existing) {
            const following = positioned.find((item) => item.end > sentence.end);
            if (!following || following.block.type !== "p" || positioned.some((item) => item.block.type === "hr" && item.start === sentence.end)) {
                reject("no_following_body"); continue;
            }
        }
        const alreadyDivided = raw.action === "section" && positioned.some((item) => item.block.type === "hr" && item.start === sentence.start);
        if (!existing && !alreadyDivided && counts[raw.action] >= (raw.action === "h3" ? 6 : 3)) {
            reject("limit"); continue;
        }
        seen.add(sentence.sentenceId);
        diagnostics.accepted += 1;
        if (existing || alreadyDivided) continue;
        counts[raw.action] += 1;
        approved.push({ ...sentence, action: raw.action });
    }
    if (!approved.length) return blocks;
    approved.sort((a, b) => a.start - b.start);
    // Do not consume the first heading's only following body sentence with
    // another heading/divider. Reject that item, not the rest of the article.
    for (let index = 1; index < approved.length; index += 1) {
        const previous = approved[index - 1];
        if (previous.action === "h3" && previous.end === approved[index].start) {
            approved.splice(index, 1);
            diagnostics.accepted -= 1;
            reject("adjacent_structure");
            index -= 1;
        }
    }
    const result = [];
    const dividers = new Set(approved.map((item) => item.start));
    const headings = approved.filter((item) => item.action === "h3");
    for (const { block, start, end } of positioned) {
        if (block.type === "hr") { result.push(block); continue; }
        const cuts = [...new Set([start, end, ...approved.flatMap((item) => item.action === "h3" ? [item.start, item.end] : [item.start])
            .filter((cut) => cut > start && cut < end)])].sort((a, b) => a - b);
        for (let index = 0; index < cuts.length - 1; index += 1) {
            const left = cuts[index];
            const right = cuts[index + 1];
            if (dividers.has(left)) result.push(makeBlock("hr"));
            const heading = headings.find((item) => left >= item.start && left < item.end);
            if (heading) {
                if (left === heading.start) {
                    const text = positioned.filter((item) => item.end > heading.start && item.start < heading.end)
                        .map((item) => sourceSlice(item.block.text, Math.max(0, heading.start - item.start), Math.min(item.end, heading.end) - item.start)).join("");
                    result.push(makeBlock("h3", text));
                }
                continue;
            }
            if (left === start && right === end) result.push(block);
            else {
                const text = sourceSlice(block.text, left - start, right - start);
                if (text) result.push(makeBlock("p", text, false, false, createRuleBasedSegments(text, "p")));
            }
        }
    }
    const compacted = compactDividers(result);
    if (!draftPreservesSource(compacted, source)) {
        reject("text_mismatch");
        return createBlocksFromText(source);
    }
    return applyRuleBasedEmphasis(compacted);
}

// The browser never trusts returned paragraph boundaries. Recover individual
// suggestions by source position, then run the very same validator as the API.
function restoreSafeStructure(aiBlocks, localBlocks, source) {
    const sentences = buildSentenceIndex(source);
    const byStart = new Map(sentences.map((sentence) => [sentence.start, sentence]));
    const suggestions = [];
    const positioned = positionedBlocks(aiBlocks);
    positioned.forEach(({ block, start, end }, index) => {
        const sentence = byStart.get(start);
        if (!sentence) return;
        if (block.type === "h3" && end === sentence.end) suggestions.push({ sentenceId: sentence.sentenceId, action: "h3" });
        if (block.type === "hr" && positioned[index + 1]?.block.type !== "h3") {
            suggestions.push({ sentenceId: sentence.sentenceId, action: "section" });
        }
    });
    return applyStructureSuggestions(localBlocks, suggestions, source);
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
function isTitleLike(line) {
    return line.length <= 34 && !endPunctuation.test(line);
}
function getTextLines(input) {
    const rawLines = input.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());
    const nonEmptyLines = rawLines.reduce((result, text, index) => {
        if (!text)
            return result;
        result.push({
            text,
            hasBlankBefore: index === 0 || rawLines[index - 1] === "",
            hasBlankAfter: index === rawLines.length - 1 || rawLines[index + 1] === "",
            nonEmptyIndex: result.length,
        });
        return result;
    }, []);
    const lines = [];
    let paragraphLines = [];
    const pushLine = (line) => {
        lines.push({ ...line, nonEmptyIndex: lines.length });
    };
    const flushParagraph = () => {
        if (!paragraphLines.length)
            return;
        const firstLine = paragraphLines[0];
        const lastLine = paragraphLines[paragraphLines.length - 1];
        pushLine({
            text: joinSoftWrappedLines(paragraphLines.map((line) => line.text)),
            hasBlankBefore: firstLine.hasBlankBefore,
            hasBlankAfter: lastLine.hasBlankAfter,
        });
        paragraphLines = [];
    };
    nonEmptyLines.forEach((line) => {
        const isFirstEffectiveLine = lines.length === 0 && paragraphLines.length === 0;
        const shouldKeepAsOwnLine = isFirstEffectiveLine ||
            markdownDividerPattern.test(line.text) ||
            Boolean(getMarkdownHeading(line.text)) ||
            isSubheadingLike(line);
        if (shouldKeepAsOwnLine) {
            flushParagraph();
            pushLine(line);
            return;
        }
        paragraphLines.push(line);
        if (line.hasBlankAfter)
            flushParagraph();
    });
    flushParagraph();
    return lines;
}
function joinSoftWrappedLines(lines) {
    return lines.reduce((result, line) => {
        if (!result)
            return line;
        const previousChar = result[result.length - 1] ?? "";
        const nextChar = line[0] ?? "";
        const needsSpace = /[A-Za-z0-9)]/.test(previousChar) && /[A-Za-z0-9(]/.test(nextChar);
        return `${result}${needsSpace ? " " : ""}${line}`;
    }, "");
}
function isSubheadingLike(line) {
    if (line.text.length > 22)
        return false;
    if (headingPattern.test(line.text))
        return true;
    const looksStandalone = line.hasBlankBefore || line.hasBlankAfter;
    return looksStandalone && !endPunctuation.test(line.text) && line.text.length <= 12;
}
function cleanPrefix(line) {
    return line.replace(/^#{1,3}\s+/, "").replace(/^[-*]\s+/, "").trim();
}
function getMarkdownHeading(line) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!match)
        return null;
    return {
        level: match[1].length,
        text: match[2].trim(),
    };
}
function splitLeadingStructuralHeading(line, allowNumberedMatter = false) {
    const firstSentence = completeSentenceRanges(line)[0];
    if (!firstSentence?.complete || firstSentence.start !== 0)
        return null;
    const heading = line.slice(firstSentence.start, firstSentence.end).trim();
    const headingLength = getComparableTextLength(heading);
    const isNumberedMatter = allowNumberedMatter && numberedMatterOpeningPattern.test(heading);
    if (headingLength < structuralHeadingMinLength ||
        headingLength > (isNumberedMatter ? numberedMatterHeadingMaxLength : structuralHeadingMaxLength) ||
        (!isNumberedMatter && !structuralHeadingOpeningPattern.test(heading))) {
        return null;
    }
    return {
        heading,
        remainder: line.slice(firstSentence.end).trim(),
    };
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
function splitIntoInfoBlocks(line) {
    const units = getSentenceRanges(line).flatMap((range) => splitLongSentenceRange(line, range));
    if (!units.length)
        return [line].filter(Boolean);
    const blocks = [];
    let current = null;
    let currentUnitCount = 0;
    units.forEach((unit) => {
        if (!current) {
            current = { ...unit };
            currentUnitCount = 1;
            return;
        }
        const currentText = line.slice(current.start, current.end);
        const currentLength = getComparableTextLength(currentText);
        const nextLength = getComparableTextLength(line.slice(current.start, unit.end));
        const canAddUnit = currentUnitCount < infoBlockMaxUnits;
        const currentCanStandAlone = isStandaloneInfoUnit(currentText);
        const shouldMergeShortBlock = currentLength < infoBlockMinLength && !currentCanStandAlone && nextLength <= infoBlockForcedMaxLength;
        const fitsTargetBlock = !currentCanStandAlone && nextLength <= infoBlockTargetMaxLength;
        if (canAddUnit && (shouldMergeShortBlock || fitsTargetBlock)) {
            current.end = unit.end;
            currentUnitCount += 1;
            return;
        }
        blocks.push(current);
        current = { ...unit };
        currentUnitCount = 1;
    });
    if (current)
        blocks.push(current);
    mergeShortTrailingBlock(line, blocks);
    return blocks.map((range) => line.slice(range.start, range.end).trim()).filter(Boolean);
}
function splitLongSentenceRange(line, range) {
    const sentence = line.slice(range.start, range.end);
    if (getComparableTextLength(sentence) <= longSentenceSplitLength)
        return [range];
    const clauses = getRegexRanges(sentence, softClausePattern).map((clause) => ({
        start: range.start + clause.start,
        end: range.start + clause.end,
    }));
    return clauses.length > 1 ? clauses : [range];
}
function mergeShortTrailingBlock(line, blocks) {
    if (blocks.length < 2)
        return;
    const last = blocks[blocks.length - 1];
    const previous = blocks[blocks.length - 2];
    const lastLength = getComparableTextLength(line.slice(last.start, last.end));
    const mergedLength = getComparableTextLength(line.slice(previous.start, last.end));
    if (lastLength <= orphanInfoBlockMaxLength && mergedLength <= infoBlockTargetMaxLength) {
        previous.end = last.end;
        blocks.pop();
    }
}
function isStandaloneInfoUnit(text) {
    const length = getComparableTextLength(text);
    if (length < 12)
        return false;
    return (scoreInlineColorCandidate(text, "red") >= inlineColorScoreThreshold ||
        scoreInlineColorCandidate(text, "blue") >= inlineColorScoreThreshold);
}
function getSentenceRanges(text) {
    const ranges = getRegexRanges(text, hardSentencePattern);
    return ranges.length ? ranges : trimTextRange(text, 0, text.length);
}
function getRegexRanges(text, pattern) {
    const ranges = [];
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match;
    while ((match = regex.exec(text))) {
        const range = trimTextRange(text, match.index, match.index + match[0].length);
        ranges.push(...range);
    }
    return ranges;
}
function trimTextRange(text, start, end) {
    let nextStart = start;
    let nextEnd = end;
    while (nextStart < nextEnd && /\s/.test(text[nextStart]))
        nextStart += 1;
    while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1]))
        nextEnd -= 1;
    return nextStart < nextEnd ? [{ start: nextStart, end: nextEnd }] : [];
}
function shouldStartImplicitSection(blocks, hasExplicitSections, line, sectionParagraphTexts) {
    if (hasExplicitSections)
        return false;
    if (!line.hasBlankBefore)
        return false;
    if (sectionParagraphTexts.length === 0)
        return false;
    if (blocks[blocks.length - 1]?.type === "hr")
        return false;
    if (implicitSectionPivotPattern.test(line.text))
        return true;
    const sectionTextLength = sectionParagraphTexts.reduce((total, text) => total + getComparableTextLength(text), 0);
    const hasEnoughContext = sectionParagraphTexts.length >= implicitSectionMinParagraphs || sectionTextLength >= implicitSectionMinChars;
    return hasEnoughContext && scoreImplicitSectionShift(line.text, sectionParagraphTexts) >= 4;
}
function scoreImplicitSectionShift(currentText, previousTexts) {
    const previousText = previousTexts.join("");
    let score = 0;
    if (implicitSectionPivotPattern.test(currentText))
        score += 4;
    if (implicitSectionOpeningPattern.test(currentText))
        score += 4;
    if (implicitSectionAdvicePattern.test(currentText))
        score += 2;
    if (implicitSectionScenePattern.test(previousText) && implicitSectionAdvicePattern.test(currentText))
        score += 2;
    if (/^(\d+[、.．）)]|[一二三四五六七八九十]+[、.．])/.test(currentText))
        score += 4;
    if (continuationOpeningPattern.test(currentText))
        score -= 4;
    return score;
}
function scoreHighlightSentence(sentence, index, total) {
    let score = 0;
    const isFirstOrLast = index === 0 || index === total - 1;
    if (isFirstOrLast && total > 1)
        score += 2;
    if (explicitStancePattern.test(sentence))
        score += 5;
    if (highlightPattern.test(sentence))
        score += 2;
    if (summaryPattern.test(sentence))
        score += 2;
    if (/\d+(\.\d+)?\s*(%|倍|个|条|步|天|分钟|小时|元)/.test(sentence))
        score += 2;
    if (sentence.length >= 12 && sentence.length <= 70)
        score += 1;
    if (sentence.length < 8 || sentence.length > 96)
        score -= 2;
    return score;
}
function scoreUnderlineSentence(sentence, index, total) {
    let score = 0;
    const isFirstOrLast = index === 0 || index === total - 1;
    if (underlinePattern.test(sentence))
        score += 4;
    if (hasProhibition(sentence))
        score += 4;
    if (inlineRedActionPattern.test(sentence))
        score += 2;
    if (/(不等于|不代表)/.test(sentence))
        score += 2;
    if (/(太多|过度|反而|否则|一旦|导致|失去|降低|变差|出错|失控)/.test(sentence))
        score += 2;
    if (isFirstOrLast && total > 1)
        score += 1;
    if (sentence.length >= 8 && sentence.length <= 80)
        score += 1;
    if (sentence.length < 6 || sentence.length > 120)
        score -= 2;
    return score;
}
function addDividerIfNeeded(blocks) {
    const last = blocks[blocks.length - 1];
    if (last && last.type !== "hr" && blocks.some((block) => block.type !== "h1")) {
        blocks.push(makeBlock("hr"));
    }
}
function addDividerAfterTitleIfNeeded(blocks) {
    const last = blocks[blocks.length - 1];
    if (last?.type === "h1") {
        blocks.push(makeBlock("hr"));
    }
}
function compactDividers(blocks) {
    const compacted = blocks.reduce((result, block) => {
        if (block.type !== "hr") {
            result.push(block);
            return result;
        }
        const previous = result[result.length - 1];
        if (previous && previous.type !== "hr") {
            result.push(block);
        }
        return result;
    }, []);
    return compacted.filter((block, index, all) => {
        if (block.type !== "hr")
            return true;
        return index > 0 && index < all.length - 1;
    });
}
function createComparableStyleStream(blocks) {
    const characters = [];
    const styles = [];
    blocks.forEach((block) => {
        if (block.type === "hr")
            return;
        const segments = normalizeTextSegments(block.segments) ?? [{ text: block.text }];
        segments.forEach((segment) => {
            Array.from(segment.text).forEach((character) => {
                if (/\s/.test(character))
                    return;
                characters.push(character);
                styles.push({ bold: segment.bold, color: segment.color });
            });
        });
    });
    return { text: characters.join(""), styles };
}
function mergeCharacterStyles(localStyle, aiStyle) {
    return {
        bold: aiStyle?.bold ?? localStyle.bold,
        color: aiStyle?.color ?? localStyle.color,
    };
}
function applyComparableStyles(blocks, styles, aiStyles) {
    let styleOffset = 0;
    return blocks.map((block) => {
        if (block.type === "hr")
            return block;
        const blockStyleCount = getComparableTextLength(block.text);
        const blockStyles = styles.slice(styleOffset, styleOffset + blockStyleCount);
        const aiBlockStyles = aiStyles.slice(styleOffset, styleOffset + blockStyleCount);
        styleOffset += blockStyleCount;
        const effectiveStyles = aiBlockStyles.some((style) => style.color)
            ? blockStyles.map((style, index) => ({ ...style, color: aiBlockStyles[index]?.color }))
            : blockStyles;
        return {
            ...block,
            segments: block.type === "p" ? createSegmentsFromComparableStyles(block.text, effectiveStyles) : undefined,
        };
    });
}
function createSegmentsFromComparableStyles(text, styles) {
    let styleIndex = 0;
    const characterSegments = Array.from(text).map((character) => {
        if (/\s/.test(character))
            return { text: character };
        const style = styles[styleIndex] ?? {};
        styleIndex += 1;
        return { text: character, bold: style.bold, color: style.color };
    });
    const normalized = normalizeTextSegments(characterSegments);
    return normalized?.some((segment) => segment.bold || segment.color) ? normalized : undefined;
}
function prepareAiDraftBlock(block) {
    if (block.type === "hr") {
        return {
            ...block,
            text: "",
            segments: undefined,
            highlight: false,
            underline: false,
        };
    }
    return {
        ...block,
        segments: cleanDraftSegments(block) ?? createRuleBasedSegments(block.text, block.type),
        highlight: false,
        underline: false,
    };
}
function cleanDraftSegments(block) {
    const segments = normalizeTextSegments(block.segments);
    if (!segments)
        return undefined;
    let coloredSegments = 0;
    let coloredChars = 0;
    const cleanedSegments = segments.map((segment) => {
        const color = shouldKeepInlineColor(segment, block, coloredSegments, coloredChars) ? segment.color : undefined;
        if (color) {
            coloredSegments += 1;
            coloredChars += getComparableTextLength(segment.text);
        }
        return {
            text: segment.text,
            bold: segment.bold,
            color,
        };
    });
    const normalized = normalizeTextSegments(cleanedSegments);
    if (!normalized?.some((segment) => segment.bold || segment.color))
        return undefined;
    return normalized;
}
function shouldKeepInlineColor(segment, block, coloredSegments, coloredChars) {
    if (!segment.color || block.type !== "p")
        return false;
    const segmentText = segment.text.trim();
    const segmentLength = getComparableTextLength(segmentText);
    const blockLength = getComparableTextLength(block.text);
    const isWholeSingleSentenceBlock = isWholeSingleSentenceSegment(block.text, segmentText);
    if (segmentLength < minInlineColorLength || segmentLength > maxInlineColorLength)
        return false;
    if (getSentenceRanges(segmentText).length > 1)
        return false;
    if (blockLength > 0 && segmentLength / blockLength > maxInlineColorRatio && !isWholeSingleSentenceBlock) {
        return false;
    }
    if (coloredSegments >= maxInlineColorSegmentsPerBlock)
        return false;
    if (coloredChars + segmentLength > maxInlineColorCharsPerBlock)
        return false;
    return true;
}
function isWholeSingleSentenceSegment(blockText, segmentText) {
    return getSentenceRanges(blockText).length <= 1 && getComparableText(blockText) === getComparableText(segmentText);
}
function getComparableText(text) {
    return text.replace(/\s/g, "");
}
function getComparableTextLength(text) {
    return Array.from(getComparableText(text)).length;
}
function hasProhibition(text) {
    return prohibitionPattern.test(text.replace(/能不能/g, ""));
}
export function applyRuleBasedEmphasis(blocks) {
    const emphasizedBlocks = blocks.map((block) => ({
        ...block,
        highlight: false,
        underline: false,
    }));
    const paragraphGroups = getParagraphGroups(emphasizedBlocks);
    const underlineCandidates = chooseEmphasisCandidates(emphasizedBlocks, paragraphGroups, scoreUnderlineSentence, 4, new Set()).slice(0, maxArticleUnderlines);
    const underlinedIndexes = new Set(underlineCandidates.map((candidate) => candidate.blockIndex));
    const highlightCandidates = chooseEmphasisCandidates(emphasizedBlocks, paragraphGroups, scoreHighlightSentence, 3, underlinedIndexes).slice(0, maxArticleHighlights);
    underlineCandidates.forEach(({ blockIndex }) => {
        emphasizedBlocks[blockIndex].underline = true;
    });
    highlightCandidates.forEach(({ blockIndex }) => {
        emphasizedBlocks[blockIndex].highlight = true;
    });
    return emphasizedBlocks;
}
function getParagraphGroups(blocks) {
    const groups = [];
    let current = [];
    blocks.forEach((block, index) => {
        if (block.type === "p") {
            current.push(index);
            return;
        }
        if (current.length)
            groups.push(current);
        current = [];
    });
    if (current.length)
        groups.push(current);
    return groups;
}
function chooseEmphasisCandidates(blocks, paragraphGroups, scorer, threshold, excludedIndexes) {
    return paragraphGroups
        .map((group) => {
        let best = null;
        for (let index = 0; index < group.length; index += 1) {
            const blockIndex = group[index];
            if (excludedIndexes.has(blockIndex))
                continue;
            const score = scorer(blocks[blockIndex].text, index, group.length);
            if (!best || score > best.score || (score === best.score && index === group.length - 1)) {
                best = { blockIndex, score };
            }
        }
        return best && best.score >= threshold ? best : null;
    })
        .filter((candidate) => candidate !== null)
        .sort((a, b) => b.score - a.score || a.blockIndex - b.blockIndex);
}
function createRuleBasedSegments(text, blockType) {
    if (blockType !== "p")
        return undefined;
    const selectedRange = chooseInlineColorRange(text);
    if (!selectedRange)
        return undefined;
    const segments = [];
    let cursor = 0;
    if (selectedRange.start > cursor) {
        segments.push({ text: text.slice(cursor, selectedRange.start) });
    }
    segments.push({ text: text.slice(selectedRange.start, selectedRange.end), bold: true, color: selectedRange.color });
    cursor = selectedRange.end;
    if (cursor < text.length) {
        segments.push({ text: text.slice(cursor) });
    }
    return normalizeTextSegments(segments);
}
function chooseInlineColorRange(text) {
    const ranges = getInlineColorCandidateRanges(text)
        .flatMap((range) => {
        const candidateText = text.slice(range.start, range.end).trim();
        return ["red", "blue"].map((color) => ({
            ...range,
            color,
            score: scoreInlineColorCandidate(candidateText, color),
        }));
    })
        .filter((range) => range.score >= inlineColorScoreThreshold)
        .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        if (scoreDelta !== 0)
            return scoreDelta;
        if (a.color !== b.color)
            return a.color === "red" ? -1 : 1;
        return b.end - b.start - (a.end - a.start) || a.start - b.start;
    });
    return ranges[0];
}
function getInlineColorCandidateRanges(text) {
    const ranges = [];
    const addRange = (range) => {
        const length = getComparableTextLength(text.slice(range.start, range.end));
        const alreadyExists = ranges.some((item) => item.start === range.start && item.end === range.end);
        if (!alreadyExists && length >= minInlineColorLength && length <= maxInlineColorLength) {
            ranges.push(range);
        }
    };
    getSentenceRanges(text).forEach((sentenceRange) => {
        addRange(sentenceRange);
        const sentence = text.slice(sentenceRange.start, sentenceRange.end);
        const clauseRanges = getRegexRanges(sentence, softClausePattern).map((range) => ({
            start: sentenceRange.start + range.start,
            end: sentenceRange.start + range.end,
        }));
        if (clauseRanges.length > 1) {
            clauseRanges.forEach(addRange);
        }
    });
    return ranges;
}
function scoreInlineColorCandidate(text, color) {
    const length = getComparableTextLength(text);
    if (length < minInlineColorLength || length > maxInlineColorLength)
        return Number.NEGATIVE_INFINITY;
    let score = 0;
    if (inlineColorCuePatterns[color].test(text))
        score += 4;
    if (color === "red" && hasProhibition(text))
        score += 4;
    if (color === "red" && inlineRedActionPattern.test(text))
        score += 2;
    if (color === "blue" && inlineBlueActionPattern.test(text))
        score += 2;
    if (color === "blue" && summaryPattern.test(text))
        score += 2;
    if (color === "blue" && /\d+(\.\d+)?\s*(%|倍|个|条|步|天|分钟|小时|元)/.test(text))
        score += 2;
    if (color === "blue" && /(才是|就能|即可|更重要|更适合|更容易|更值得|更清楚|更稳定|更有效)/.test(text)) {
        score += 2;
    }
    if (color === "red" && /(太多|过度|反而|否则|一旦|导致|失去|降低|变差)/.test(text))
        score += 1;
    if (color === "red" && /(不等于|不代表)/.test(text))
        score += 2;
    if (color === "blue" && /(不是.+而是|只解决一个问题|一直在获得信息)/.test(text))
        score += 1;
    if (length >= 12 && length <= 45)
        score += 1;
    return score;
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
