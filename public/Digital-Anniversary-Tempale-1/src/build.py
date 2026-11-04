# Generates index.html. Edit text/photos in index.html directly, or tweak here and re-run.
def P(f):
    # photos (change per user) live in src/photos, design layers (textures, stickers) in src/layers
    return 'src/' + ('photos/' if '-photo-' in f else 'layers/') + f


U = lambda n: f"{n/19.2:.3f}cqw"
i = 0


def el(inner, x, y, w, rot=0, cls='', h=None):
    global i
    i += 1
    hh = f"height:{U(h)};" if h else ''
    return f'<div class="el {cls}" style="left:{U(x)};top:{U(y)};width:{U(w)};--w:{U(w)};{hh}--r:{rot}deg;--i:{i};--dx:{[-12,0,12,0][i%4]}cqw;--dy:{[0,10,0,-10][i%4]}cqw">{inner}</div>'


def img(src): return f'<img src="{P(src)}" alt="">'


def pol(src, x, y, w, rot=0, ratio=1.0):
    return el(f'<div class="ph" style="aspect-ratio:{ratio}">{img(src)}</div>', x, y, w, rot, 'pol')


def sticker(src, x, y, w, rot=0): return el(img(src), x, y, w, rot, 'st')


def photo(src, x, y, w, h, rot=0):
    return el(f'<img src="{P(src)}" alt="" style="width:100%;height:100%;object-fit:cover">', x, y, w, rot, 'ph2', h)


def heartphoto(src, x, y, w, rot=0):
    return el(f'<div class="heart">{img(src)}</div>', x, y, w, rot, 'st')


def strip(srcs, x, y, w, rot):
    cells = ''.join(f'<div class="cell">{img(s)}</div>' for s in srcs)
    return el(f'<div class="strip">{cells}</div>', x, y, w, rot, 'pol')


def quote(t, x, y): return el(f'<p class="quote">{t}</p>', x, y, 700, 0, 'tx')


SCRIB = ('<div class="scrib"><svg viewBox="0 0 100 100"><path d="M50 86C20 62 8 44 18 26c8-12 24-8 32 6 8-14 24-18 32-6 10 18-2 36-32 60z" '
         'fill="none" stroke="#a0301d" stroke-width="5" stroke-linejoin="round"/><path d="M28 34l40 8M24 46l46 10M30 58l34 10M38 70l22 8" '
         'stroke="#a0301d" stroke-width="4" stroke-linecap="round"/></svg></div>')


def scrib(x, y, w, rot=0): return el(SCRIB, x, y, w, rot, 'st')


HEAD = 'Our Anniversary'


def slide(n, bg, body, dark=False, half=None):
    global i
    i = 0
    return None


def build(n, bg, body_fn, dark=False, half=None):
    global i
    i = 0
    body = body_fn()
    hf = f'<div class="half" style="background-image:url({P(half[0])});{half[1]}"></div>' if half else ''
    return (f'<!-- Slide {n} -->\n<section class="slide{" dark" if dark else ""}" id="s{n}" style="background-image:url({P(bg)})">{hf}'
            f'<div class="stage">\n{body}\n</div></section>\n')


S = []
S.append(build(1, 'slide01-texture-red-fabric.jpg', lambda:
    sticker('slide01-flower-pink.png', 520, 10, 720) + strip(['slide01-photo-1.jpg', 'slide01-photo-2.jpg', 'slide01-photo-3.jpg'], 235, 110, 295, -5)
    + strip(['slide01-photo-4.jpg', 'slide01-photo-5.jpg', 'slide01-photo-6.jpg'], 560, 175, 295, 3) + sticker('slide01-stars-black.png', 1390, 90, 250)
    + pol('slide01-photo-7.jpg', 1480, 560, 330, 9, 1.05)
    + el('<h1 class="script">Valentine’s<br>Day</h1>', 1066, 380, 800, 0, 'tx'),
    dark=True, half=('slide01-texture-beige-board.jpg', 'width:41.5%')))
S.append(build(2, 'slide02-texture-beige-paper.jpg', lambda:
    sticker('slide02-sticky-note.png', 118, 120, 672) + pol('slide02-photo-1.jpg', 345, 290, 540, -10.5, 1.0) + pol('slide02-photo-2.jpg', 925, 147, 341, 0, .9)
    + pol('slide02-photo-3.jpg', 1320, 345, 480, 0, .95) + scrib(790, 690, 260, -8)))
S.append(build(3, 'slide03-texture-red-weave.jpg', lambda:
    sticker('slide03-paper-ruled.png', 390, 140, 600) + sticker('slide03-paper-handwritten.png', 1085, 300, 420) + heartphoto('slide03-photo-1.jpg', 625, 150, 720)
    + heartphoto('slide03-photo-3.jpg', 140, 480, 470, -3) + heartphoto('slide03-photo-2.jpg', 1285, 480, 500, 3) + sticker('slide03-stars-black.png', 1390, 110, 260)
    + quote('“My heart knows<br>your name.”', 185, 290), dark=True))
S.append(build(4, 'slide04-texture-sand.jpg', lambda:
    sticker('slide04-paper-ruled-torn.png', 1170, 0, 760) + sticker('slide04-torn-paper-red.png', 470, 120, 1000) + sticker('slide04-heart-red.png', 215, 570, 230)
    + pol('slide04-photo-1.jpg', 160, 130, 330, -8, 1.3) + pol('slide04-photo-2.jpg', 600, 130, 350, 7, .85) + pol('slide04-photo-3.jpg', 1080, 150, 420, 5, 1.2)
    + pol('slide04-photo-4.jpg', 520, 560, 380, -6, .85) + pol('slide04-photo-5.jpg', 1000, 590, 370, 8, .9) + pol('slide04-photo-6.jpg', 1440, 560, 420, -4, 1.2)))
S.append(build(5, 'slide05-texture-sand.jpg', lambda:
    sticker('slide05-sticky-note.png', 455, 130, 640) + pol('slide05-photo-2.jpg', 250, 290, 640, 0, 1.25) + sticker('slide05-stars-black.png', 560, 540, 270)
    + photo('slide05-photo-1.jpg', 1120, 150, 640, 780) + scrib(1000, 770, 300, -6),
    half=('slide05-texture-red-weave.jpg', 'width:50%')))
S.append(build(6, 'slide06-texture-cream-crumpled.jpg', lambda:
    sticker('slide06-paper-handwritten.png', 1340, 0, 580) + sticker('slide06-torn-paper-red.png', 0, 200, 520) + photo('slide06-photo-1.jpg', 170, 170, 740, 360)
    + photo('slide06-photo-2.jpg', 1000, 520, 740, 500) + sticker('slide06-heart-red.png', 870, 420, 250) + sticker('slide06-stars-black.png', 430, 690, 280)
    + quote('“I deserve a love<br>that feels kind,<br>safe, and true.”', 1080, 280)))
S.append(build(7, 'slide07-texture-cream.jpg', lambda:
    sticker('slide07-sticky-note.png', 90, 90, 700) + pol('slide07-photo-1.jpg', 230, 260, 430, -6, .8) + pol('slide07-photo-2.jpg', 690, 140, 520, 0, .72)
    + pol('slide07-photo-3.jpg', 1260, 290, 460, 6, .78) + sticker('slide07-stars-black.png', 1450, 40, 260) + scrib(1010, 820, 230, 6)
    + quote('“You, always you.”', 150, 160)))
S.append(build(8, 'slide08-texture-red-weave.jpg', lambda:
    sticker('slide08-paper-handwritten.png', 1215, 0, 705)
    + pol('slide08-photo-1.jpg', 60, 90, 380, -6, 1.3) + pol('slide08-photo-2.jpg', 470, 60, 380, 4, 1.3) + pol('slide08-photo-3.jpg', 880, 110, 340, -3, 1.3)
    + pol('slide08-photo-4.jpg', 150, 430, 390, 4, 1.3) + pol('slide08-photo-5.jpg', 580, 390, 390, -5, 1.3)
    + pol('slide08-photo-6.jpg', 90, 740, 360, -3, 1.3) + pol('slide08-photo-7.jpg', 650, 720, 400, 5, 1.3), dark=True))
S.append(build(9, 'slide09-texture-cream-crumpled.jpg', lambda:
    sticker('slide09-torn-paper-red.png', 0, 0, 520) + sticker('slide09-sticky-note.png', 140, 90, 520) + pol('slide09-photo-1.jpg', 160, 300, 560, -5, 1.3)
    + pol('slide09-photo-2.jpg', 780, 100, 400, 3, .75) + pol('slide09-photo-3.jpg', 1230, 130, 360, -3, .72) + pol('slide09-photo-4.jpg', 1000, 560, 520, 4, 1.3)
    + sticker('slide09-heart-red.png', 1590, 620, 230) + sticker('slide09-stars-black.png', 700, 640, 260) + quote('“Chosen. Loved.<br>Forever.”', 170, 860), dark=True))
S.append(build(10, 'slide10-texture-cream-crumpled.jpg', lambda:
    pol('slide10-photo-1.jpg', 1010, 110, 760, 3, 1.25) + sticker('slide10-heart-red.png', 860, 640, 260) + sticker('slide10-stars-black.png', 1560, 700, 300)
    + el('<h1 class="script big">Thank<br>You</h1>', 170, 300, 760, 0, 'tx')))

HEART = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 92' preserveAspectRatio='none'>"
         "<path d='M50 91C18 66 2 46 8 26 14 8 38 4 50 24 62 4 86 8 92 26 98 46 82 66 50 91z'/></svg>")
CSS = '''*{box-sizing:border-box}
html{scroll-snap-type:y mandatory;scroll-behavior:smooth;scrollbar-width:none;background:#6b181c}
html::-webkit-scrollbar{display:none}
body{margin:0;font-family:Roboto,Arial,sans-serif;color:#6c1e13}
.slide{position:relative;height:100vh;height:100dvh;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;overflow:hidden;background-size:cover;background-position:center}
.half{position:absolute;left:0;top:0;bottom:0;background-size:cover;background-position:center}
.stage{position:relative;width:min(100vw,177.78vh);width:min(100vw,177.78dvh);aspect-ratio:16/9;container-type:inline-size;flex:none}
.hd{position:absolute;left:5.6cqw;top:1.7cqw;font-size:1.8cqw;z-index:5}
.num{position:absolute;right:5.5cqw;top:1.3cqw;font-size:2.4cqw;z-index:5}
.dark .hd,.dark .num{color:#fff}
.el{position:absolute;opacity:0;transform:translate(var(--dx),var(--dy)) rotate(calc(var(--r) - 8deg)) scale(.85);transition:opacity .9s ease,transform 1.2s cubic-bezier(.2,.9,.25,1.1);transition-delay:calc(var(--i)*140ms)}
.slide.in .el{opacity:1;transform:rotate(var(--r))}
.slide.in .el.pol,.slide.in .el.st{animation:sway 6s ease-in-out infinite;animation-delay:calc(1.6s + var(--i)*.4s)}
@keyframes sway{0%,100%{transform:rotate(var(--r)) translateY(0)}50%{transform:rotate(calc(var(--r) + 1.2deg)) translateY(-.5cqw)}}
.slide.in .script{animation:glow 3.5s ease-in-out infinite alternate}
@keyframes glow{from{text-shadow:0 0 0 rgba(255,255,255,0)}to{text-shadow:0 0 1.6cqw rgba(255,255,255,.55)}}
.el img{display:block;width:100%}
.pol{background:#f3f1eb;padding:calc(var(--w)*.05) calc(var(--w)*.05) calc(var(--w)*.17);box-shadow:0 .5cqw 1.2cqw rgba(0,0,0,.3)}
.ph{overflow:hidden}.ph img{height:100%;object-fit:cover}
.ph2{box-shadow:0 .5cqw 1.2cqw rgba(0,0,0,.25);overflow:hidden}
.st{filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.3))}
.heart{aspect-ratio:100/92;overflow:hidden;-webkit-mask:url("HEARTURL") center/100% 100% no-repeat;mask:url("HEARTURL") center/100% 100% no-repeat}
.heart img{height:100%;object-fit:cover}
.strip{background:#f3f1eb;padding:calc(var(--w)*.08) calc(var(--w)*.08) calc(var(--w)*.03);display:grid;gap:calc(var(--w)*.035);box-shadow:0 .5cqw 1.2cqw rgba(0,0,0,.3)}
.strip .cell{aspect-ratio:1.04/1;overflow:hidden}.strip .cell img{height:100%;object-fit:cover}
.scrib{background:#f3f1eb;padding:calc(var(--w)*.12);clip-path:polygon(4% 0,100% 6%,96% 100%,0 92%)}.scrib svg{display:block;width:100%}
.quote{margin:0;display:inline-block;background:#6c1e13;color:#fff;font-size:2.7cqw;line-height:1.12;padding:.4cqw .8cqw}
.script{margin:0;font-family:"Pinyon Script","Great Vibes",cursive;font-weight:400;font-size:9.4cqw;line-height:.95;color:#fff}
.script.big{font-size:14cqw;color:#6c1e13}
.dots{position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:10;display:grid;gap:11px}
.dots a{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.6);box-shadow:0 0 0 1px rgba(107,24,28,.7);transition:.25s}
.dots a.on{background:#c9485b;transform:scale(1.5)}
@media(prefers-reduced-motion:reduce){.el{transition:none;opacity:1;transform:rotate(var(--r));animation:none!important}}'''.replace('HEARTURL', HEART)
JS = '''const slides=[...document.querySelectorAll('.slide')],dots=document.getElementById('dots');
slides.forEach(s=>{const a=document.createElement('a');a.href='#'+s.id;dots.appendChild(a)});
const links=[...dots.children];
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');links.forEach((a,i)=>a.classList.toggle('on',slides[i]===e.target))}}),{threshold:.5});
slides.forEach(s=>io.observe(s));'''
HEADER = ('<!--\n  Template 1 - Valentine\'s collage. 10 full-screen slides.\n'
          '  src/photos : couple photos (swap per user; keep the file names or edit the <img src>)\n'
          '  src/layers : textures, stickers, paper pieces (design - never change)\n'
          '  src/build.py regenerates this file; editing it by hand is fine too.\n-->\n')
html = ('<!doctype html>\n' + HEADER + '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
        "<title>Valentine's Day</title>\n"
        '<link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Roboto:wght@400;500&display=swap" rel="stylesheet">\n'
        f'<style>{CSS}</style></head><body>\n<nav class="dots" id="dots" aria-label="Pages"></nav>\n{"".join(S)}<script>{JS}</script></body></html>')
open('../index.html', 'w', encoding='utf8').write(html)
