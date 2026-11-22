import {
  AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun,
  VerticalAlign, WidthType, type ITableCellBorders,
} from 'docx';
import type { Office } from '@prisma/client';
import { bnDigits, type Block, type Cell } from './bnDeed.js';

const PAGE: Record<string, [number, number]> = { A4: [11906, 16838], A5: [8391, 11906], Letter: [12240, 15840], Legal: [12240, 20160] };
const mm = (v: number) => Math.round(v * 56.7);

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const noBorders: ITableCellBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const allBorders: ITableCellBorders = { top: LINE, bottom: LINE, left: LINE, right: LINE };

/** Word-safe Bengali font: Noto/Arial defaults fall back to Nirmala UI, which ships with Windows. */
const wordFont = (f: string) => (['Nirmala UI', 'Kalpurush', 'SolaimanLipi'].includes(f) ? f : 'Nirmala UI');

export async function renderBnDocx(blocks: Block[], office: Office, opts: { watermark: string | null; title: string }): Promise<Buffer> {
  const FONT = wordFont(office.printFont);
  const font = { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT };
  const [pw, ph] = PAGE[office.printPageSize] ?? PAGE.A4;
  const margin = mm(office.printMarginMm);
  const contentW = pw - margin * 2;

  const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text: bnDigits(text), font, bold: o.bold, boldComplexScript: o.bold, size: o.size ?? 22, sizeComplexScript: o.size ?? 22, color: o.color });

  const paras = (text: string, o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
    text.split('\n').map((line) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 80, line: 300 }, children: [run(line, o)] }));

  const cellParas = (c: Cell, header: boolean): Paragraph[] => {
    const o = typeof c === 'string' ? { text: c } : c;
    return paras(o.text, { bold: header || o.bold, align: header ? AlignmentType.CENTER : o.align === 'center' ? AlignmentType.CENTER : o.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT, after: 40 });
  };

  const dataTable = (widths: number[], rows: Cell[][], head?: boolean) => {
    const col = widths.map((w) => Math.round((contentW * w) / 100));
    return new Table({
      width: { size: contentW, type: WidthType.DXA },
      columnWidths: col,
      rows: rows.map(
        (r, ri) => {
          let ci = 0;
          return new TableRow({
            cantSplit: true,
            children: r.map((c) => {
              const span = typeof c === 'object' && c.colspan ? c.colspan : 1;
              const w = col.slice(ci, ci + span).reduce((a, b) => a + b, 0);
              ci += span;
              const header = !!head && ri === 0;
              return new TableCell({
                width: { size: w, type: WidthType.DXA },
                columnSpan: span > 1 ? span : undefined,
                borders: allBorders,
                margins: { top: 50, bottom: 50, left: 100, right: 100 },
                shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
                children: cellParas(c, header),
              });
            }),
          });
        },
      ),
    });
  };

  const children: (Paragraph | Table)[] = [];
  if (opts.watermark) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(`${opts.watermark} — খসড়া, চূড়ান্ত নয় (Draft, not final)`, { bold: true, color: 'C00000', size: 24 })] }));
  }
  if (office.printHeader) children.push(...paras(office.printHeader, { align: AlignmentType.CENTER, size: 20 }));

  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        children.push(...paras(b.text, { bold: true, size: 34, align: AlignmentType.CENTER, after: 20 }));
        if (b.sub) children.push(...paras(b.sub, { size: 24, align: AlignmentType.CENTER, after: 160 }));
        break;
      case 'heading':
        children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 80, line: 300 }, children: [run(b.text, { bold: true })] }));
        break;
      case 'para':
        children.push(...paras(b.text, { bold: b.bold, align: AlignmentType.JUSTIFIED }));
        break;
      case 'gap':
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      case 'table':
        children.push(dataTable(b.widths, b.rows, b.head));
        break;
      case 'card': {
        const left = Math.round(contentW * 0.76);
        const right = contentW - left;
        children.push(
          new Table({
            width: { size: contentW, type: WidthType.DXA },
            columnWidths: [left, right],
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: left, type: WidthType.DXA },
                    borders: noBorders,
                    children: b.rows.flatMap(([k, v]) => [new Paragraph({ spacing: { after: 30, line: 290 }, children: [run(`${k}`, { bold: false }), run('\t: '), run(v)], tabStops: [{ type: 'left' as any, position: 2800 }] })]),
                  }),
                  new TableCell({
                    width: { size: right, type: WidthType.DXA },
                    borders: allBorders,
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: paras(b.photo, { align: AlignmentType.CENTER, size: 20 }),
                  }),
                ],
              }),
            ],
          }),
        );
        break;
      }
      case 'sign': {
        const half = Math.round(contentW / 2);
        const cellFor = (text: string) =>
          new TableCell({
            width: { size: half, type: WidthType.DXA },
            borders: { top: LINE, bottom: NONE, left: NONE, right: NONE },
            margins: { top: 80, left: 200, right: 200 },
            children: paras(text, { align: AlignmentType.CENTER }),
          });
        children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
        children.push(new Table({ width: { size: contentW, type: WidthType.DXA }, columnWidths: [half, contentW - half], rows: [new TableRow({ children: [cellFor(b.left), cellFor(b.right)] })] }));
        break;
      }
    }
  }
  children.push(
    new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 } }, children: [run('Generated by Dolil OS as a drafting aid. Not a legally validated instrument; verify all facts, applicable law and approved wording before execution or registration.', { size: 17, color: '555555' })] }),
  );

  const doc = new Document({
    title: opts.title,
    creator: 'Dolil OS',
    styles: { default: { document: { run: { font, size: 22, sizeComplexScript: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: pw, height: ph }, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18, font })] })],
          }),
        },
        children,
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
