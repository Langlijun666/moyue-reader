from __future__ import annotations

import uuid
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "sample.epub"

BOOK_ID = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, 'moyue-sample-book')}"

CHAPTERS = [
    (
        "ch1",
        "慢读的理由",
        [
            "我们并不是没有时间读书，而是很少允许自己在一页纸上停留得久一点。手指划过屏幕，眼睛追着句子往前跑，心里却还惦记着下一件事。于是读完一章，像从一条拥挤的街上走过，什么也没有真正看见。",
            "慢读不是把每个字都念出声，也不是刻意拖长时间。它更像是在一段话旁边坐下来，听一听这句话为什么这样说，想一想它和你有什么关系。遇到喜欢的句子，可以合上书，看一会儿窗外，让它在心里多待几分钟。",
            "一本好书往往不急着把答案交给你。它先把一个问题放在那里，陪你走很长一段路。读得快的时候，我们容易把问题当成结论；读得慢一点，才会发现作者其实也在犹豫、在试探、在寻找。",
            "所以，不妨给自己规定一个很小的仪式：每天只读十页，读完就合上书。十页不多，却足够让文字进入生活。日子久了，书架上那些安静的书，会慢慢变成你身体里的一部分。",
            "阅读不是一场比赛。没有排行榜，也没有终点线。你翻开一本书，只是因为此刻想和某个人说说话，而那个人恰好把话写在了纸上。",
        ],
    ),
    (
        "ch2",
        "一间朝南的书房",
        [
            "理想的阅读空间不需要很大。一张桌子，一把坐得住的椅子，一扇能看见天的窗，就够了。阳光在午后慢慢移过桌面，书页的边缘被照得发亮，灰尘在光里浮起来，像极小的星群。",
            "书房里最重要的不是藏书量，而是那些你愿意反复拿下来的书。它们不必按颜色排列，也不必成套。有的书脊已经磨白，有的夹着旧车票，有的在某一页折了角。那些痕迹，都是阅读留下的路标。",
            "我曾经把书按开本大小排过一次，整齐得像一面墙。后来发现，找书的时候反而想不起它在哪里。现在书是乱放的：常读的放在手边，正在读的摞在桌角，读完暂时不想再看的，塞进最下面一层。乱有乱的道理。",
            "窗外的声音也会进入阅读。楼下有人推着车经过，远处有孩子在喊，风把树叶翻过来又翻过去。这些声音并不打扰，它们让书里的世界和外面的世界保持一点联系，像两条并行的河。",
            "到了傍晚，阳光从书脊上退下去。合上书的时候，房间里会短暂地安静一下。那安静很轻，却让人愿意明天再回到这里。",
        ],
    ),
    (
        "ch3",
        "雨天的书",
        [
            "下雨天适合读什么书？这个问题没有标准答案。有人读诗，有人读侦探小说，有人专门挑厚厚的历史。我更愿意读那些节奏慢一点的书，雨声像一层柔软的帘子，把外面的世界隔开，文字便可以走得更近。",
            "雨落在窗台上，先是零星几声，后来连成一片。屋子里暗下来，台灯的光就显得格外暖。书页在灯下泛着淡淡的黄，字与字之间好像也多了一点空隙。",
            "有一年梅雨季，我读一本讲植物的书。作者写一棵树如何在春天发芽，如何把根扎进更深的土里，写得并不惊心动魄。可窗外正好也有一棵树，雨水顺着叶子往下滴。我抬头看一眼树，再低头读一段，忽然觉得时间有了形状。",
            "雨天读书容易走神。走神也不坏。读到一半，想起小时候在屋檐下接雨，想起某个人说过的话，想起一件早已忘记的小事。书还在手里，思绪却已经出门散步。等它回来，接着读就是了。",
            "雨停之后，空气里有泥土和树叶的味道。书读到哪一页并不重要，重要的是那个下午，你和一场雨、一本书，安安静静地待在一起。",
        ],
    ),
    (
        "ch4",
        "夜航船",
        [
            "夜里读书，像乘一艘小船。四周都暗下去，只有手边的一盏灯亮着，书页是船，文字是水。你不知道会漂到哪里，也不急着靠岸。",
            "白天读书，总会被事情打断。手机亮一下，消息响一声，刚刚聚拢的注意力就散了。夜里不同。该回的消息都回了，该做的事也暂时做不完，世界终于把安静还给你。",
            "我喜欢在睡前读几页散文。太紧张的小说会让人舍不得睡，太艰深的书又会让脑子转个不停。散文刚刚好，读一段，停一停，像在岸边走几步，再回到船上。",
            "有时候读到一句话，会突然想起很久以前的一个夜晚。那时我也在读书，窗外也是这样的黑。书换了，人也在变，可灯光落在纸上的样子，好像一直没有变。",
            "困意上来的时候，就把书签夹好，关灯。船停在原地，水面还在轻轻晃。明天晚上，它还会在这里等你。",
        ],
    ),
]

CSS = """
:root { color-scheme: light; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Noto Serif CJK SC", "Songti SC", "Source Han Serif SC", SimSun, Georgia, serif;
  color: #332d26;
  background: #f7f1e7;
  line-height: 1.95;
  padding: 8% 9%;
}
h1 { font-size: 1.7em; font-weight: 600; letter-spacing: .08em; margin: 0 0 1.8em; }
h1::after { display: block; width: 2.4em; height: 1px; margin-top: .7em; background: #a5522d; content: ""; }
p { margin: 0 0 1.1em; text-align: justify; }
.cover { padding: 0; margin: 0; }
.cover img { width: 100%; height: 100%; object-fit: cover; }
""".strip()

COVER_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c06a3e"/>
      <stop offset="0.55" stop-color="#a5522d"/>
      <stop offset="1" stop-color="#74351f"/>
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6e9" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#f3e3cd" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="600" height="900" fill="url(#bg)"/>
  <rect x="34" y="34" width="532" height="832" fill="none" stroke="#fff6e9" stroke-opacity="0.28"/>
  <circle cx="470" cy="190" r="92" fill="#fff6e9" fill-opacity="0.06"/>
  <circle cx="120" cy="700" r="150" fill="#2b130b" fill-opacity="0.12"/>
  <text x="300" y="300" text-anchor="middle" fill="#fff6e9" font-family="'Noto Serif CJK SC','Songti SC',serif" font-size="72" letter-spacing="16">慢读的理由</text>
  <line x1="190" y1="350" x2="410" y2="350" stroke="#fff6e9" stroke-opacity="0.45"/>
  <text x="300" y="398" text-anchor="middle" fill="#fff6e9" fill-opacity="0.72" font-family="'Noto Serif CJK SC','Songti SC',serif" font-size="18" letter-spacing="8">给每一个愿意停一停的人</text>
  <g transform="translate(160 480)">
    <path d="M0 40 L130 12 L130 210 L0 236 Z" fill="url(#paper)"/>
    <path d="M140 12 L270 40 L270 236 L140 210 Z" fill="url(#paper)" fill-opacity="0.88"/>
    <line x1="135" y1="18" x2="135" y2="218" stroke="#a5522d" stroke-opacity="0.5"/>
    <line x1="28" y1="76" x2="112" y2="60" stroke="#a5522d" stroke-opacity="0.3"/>
    <line x1="28" y1="104" x2="112" y2="88" stroke="#a5522d" stroke-opacity="0.3"/>
    <line x1="28" y1="132" x2="112" y2="116" stroke="#a5522d" stroke-opacity="0.3"/>
    <line x1="158" y1="60" x2="242" y2="76" stroke="#a5522d" stroke-opacity="0.3"/>
    <line x1="158" y1="88" x2="242" y2="104" stroke="#a5522d" stroke-opacity="0.3"/>
    <line x1="158" y1="116" x2="242" y2="132" stroke="#a5522d" stroke-opacity="0.3"/>
  </g>
  <text x="300" y="820" text-anchor="middle" fill="#fff6e9" fill-opacity="0.7" font-family="'Noto Serif CJK SC','Songti SC',serif" font-size="18" letter-spacing="6">墨阅编辑部</text>
  <text x="300" y="850" text-anchor="middle" fill="#fff6e9" fill-opacity="0.38" font-family="sans-serif" font-size="10" letter-spacing="5">MOYUE · SLOW READING</text>
</svg>
"""


def chapter_xhtml(title: str, paragraphs: list[str]) -> str:
    body = "\n".join(f"      <p>{paragraph}</p>" for paragraph in paragraphs)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>{title}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h1>{title}</h1>
{body}
  </body>
</html>
"""


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    nav_items = "\n".join(
        f'        <li><a href="{cid}.xhtml">{title}</a></li>' for cid, title, _ in CHAPTERS
    )
    nav = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>目录</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>目录</h1>
      <ol>
{nav_items}
      </ol>
    </nav>
  </body>
</html>
"""

    nav_points = []
    for index, (cid, title, _) in enumerate(CHAPTERS, start=1):
        nav_points.append(
            f"""    <navPoint id="np{index}" playOrder="{index}">
      <navLabel><text>{title}</text></navLabel>
      <content src="{cid}.xhtml"/>
    </navPoint>"""
        )
    ncx = f"""<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="zh-CN">
  <head>
    <meta name="dtb:uid" content="{BOOK_ID}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>慢读的理由</text></docTitle>
  <navMap>
{chr(10).join(nav_points)}
  </navMap>
</ncx>
"""

    manifest_items = [
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '<item id="css" href="style.css" media-type="text/css"/>',
        '<item id="cover-image" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/>',
        '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    ]
    spine_items = ['    <itemref idref="cover" linear="no"/>']
    for cid, title, _ in CHAPTERS:
        manifest_items.append(
            f'<item id="{cid}" href="{cid}.xhtml" media-type="application/xhtml+xml"/>'
        )
        spine_items.append(f'    <itemref idref="{cid}"/>')

    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{BOOK_ID}</dc:identifier>
    <dc:title>慢读的理由</dc:title>
    <dc:creator>墨阅编辑部</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>一本关于阅读、书房、雨天和夜晚的安静小书。</dc:description>
    <dc:publisher>墨阅</dc:publisher>
    <meta property="dcterms:modified">2026-11-09T00:00:00Z</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    {chr(10).join('    ' + item for item in manifest_items)}
  </manifest>
  <spine toc="ncx">
{chr(10).join(spine_items)}
  </spine>
  <guide>
    <reference type="cover" title="封面" href="cover.xhtml"/>
  </guide>
</package>
"""

    cover_xhtml = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>封面</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body class="cover">
    <img src="cover.svg" alt="慢读的理由"/>
  </body>
</html>
"""

    files: list[tuple[str, str]] = [
        ("META-INF/container.xml", """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""),
        ("OEBPS/content.opf", opf),
        ("OEBPS/nav.xhtml", nav),
        ("OEBPS/toc.ncx", ncx),
        ("OEBPS/style.css", CSS),
        ("OEBPS/cover.svg", COVER_SVG),
        ("OEBPS/cover.xhtml", cover_xhtml),
    ]
    for cid, title, paragraphs in CHAPTERS:
        files.append((f"OEBPS/{cid}.xhtml", chapter_xhtml(title, paragraphs)))

    with zipfile.ZipFile(OUT, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        for name, content in files:
            archive.writestr(name, content.encode("utf-8"), compress_type=zipfile.ZIP_DEFLATED)

    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
