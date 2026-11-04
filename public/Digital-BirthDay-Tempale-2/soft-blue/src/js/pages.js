/* ============================================================
   THE ALBUM'S CONTENT – edit this file to change the album.

   Pictures are made in Canva (one design per theme, exported as JPG)
   and saved in assets/img – write the file name, e.g. "canva-xx-01.jpg".
   A full https:// address works too.

   Positions: x and w are % of the page width, y is % of the page height.
   r = tilt in degrees.  Pages come in pairs: each sheet has a
   front (right-hand page) and a back (left-hand page when turned).

   On every page:
     bg:       the page's paper – a Canva background
     title:    ["plain part ", "fancy part"]; ink / accent colour them,
               titleBg: true (or a colour) puts it on a taped paper label
     photos:   3D photos – { img, x, y, w, r, cap, style, ratio, square, clip, wish, wishSide, wishColor }
               style: "polaroid" (default), "print" (thin border, no caption) or "film" (dark film frame)
               ratio: picture height ÷ width (default 1.25, film 0.8); square: true for 1
               clip: a paper clip instead of tape – a colour, "gold" or "silver"
               wish: a little wish tag tucked under the bottom corner
                     (wishSide "left" or "right", wishColor any colour)
               tap a photo to pick it up for a closer look, tap again to put it down.
     texts:    { kind: "hand", text, x, y, w, r, size, color, paper }
               paper: true (or a colour) puts the words on a taped scrap of paper.
     notes:    sticky notes – { text, secret, x, y, r, color, size }
               "text" is the small heading, "secret" the wish written under it.
     stickers: puffy stickers – { shape, x, y, size, r, color }
               shape: "heart", "star", "moon" or "cloud"; add face: false for no face.
     models:   animated 3D pop-ups – { type, x, y, scale }
               "cake" (tap to blow out the candles), "gift" (tap to open),
               "teddy" (tap for a hug), "balloons" (tap to pop one),
               "ball" (tap to kick it)
     colors:   blue, butter, mint, lilac, peach, pink (or any #hex colour)
     cover:    front and back covers only – the lace-and-ribbon album board
               (see page 0 below for what goes in it)

   coil:     the spiral's colour (a #hex) – set per theme below; an API order can override it.
   Order data: see remote.js (an API can replace the name, photos, wishes, quotes and letter).

   Personal link: add ?name=xyz&from=xyz to the address and every
   {name} / {from} below is filled in (lines using them are hidden otherwise).
   ============================================================ */

// Canva papers
const BG = {
  florals:  "paper-florals.jpg",   // white paper, blue flowers in the corner
  gingham:  "paper-gingham.jpg",   // blue gingham
  gingham2: "paper-gingham2.jpg",   // soft blue gingham
  bowPaper: "paper-bow-paper.jpg",   // blue paper with a bow
  pinkSky:  "paper-pink-sky.jpg",   // pink clouds
  sunset:   "paper-sunset.jpg",   // sunset over the clouds
  roses:    "paper-roses.jpg",   // cream paper, tiny roses
  roses2:   "paper-roses2.jpg",   // cream paper, tiny flowers
  kraft:    "paper-kraft.jpg",   // crumpled kraft paper
  kraftRose:"paper-kraft-rose.jpg",   // kraft paper with a rose
  damask:   "paper-damask.jpg",   // pale blue damask
  wash:     "paper-wash.jpg",   // blue watercolour
  script:   "paper-script.jpg",   // pale blue vintage script
  cream:    "paper-cream.jpg",   // plain cream
  bows:     "paper-bows.jpg",   // little blue bows
  bowSpark: "paper-bow-spark.jpg",   // pale blue with a bow
  bowFlower:"paper-bow-flower.jpg",   // bows and flowers
  night:    "paper-night.jpg",   // starry night
  navy:     "paper-navy.jpg",   // navy watercolour
};

window.BOOK = {
  name: "xyz",      // ✎ the birthday person\'s name (or use ?name=… in the link)
  from: "xyz",      // ✎ your name (or use ?from=… in the link)
  coil: "#a9bfdc",      // the spiral binding: powder blue

  // the background behind the album
  backdrop: "",

  pages: [
    /* 0 · FRONT COVER
       cover: { paper, photo, top, title: ["plain", "italic"], name, foot }
       The whole board is drawn for you: cream linen trimmed with eyelet lace
       and a soft gold rule, an arched photo window strung with pearls, the
       title, the name on a satin ribbon with a wax seal, and a sprig of
       baby's breath in each corner. Leave out "photo" for a plain board. */
    {
      bg: BG.cream,
      cover: {
        paper: BG.gingham2,
        photo: "photo-01.jpg",
        top: "a little book of you",
        title: ["happy", "birthday"],
        name: "{name} ♡",
        foot: "open me ☁",
      },
    },

    /* 1 · hello, you */
    {
      bg: BG.florals, title: ["hello, ", "you"],
      photos: [
        { img: "photo-02.jpg", x: 20, y: 15, w: 60, r: -2, cap: "the softest soul i know",
          clip: "pink", wish: "today is all about you ♡", wishColor: "blue" },
      ],
      texts: [{ kind: "hand", text: "a little book of wishes, just for you", x: 6, y: 90, w: 88, size: 5, paper: true, r: -1 }],
      stickers: [
        { shape: "heart", x: 14, y: 13, size: 8, r: -12, color: "blue" },
        { shape: "star", x: 88, y: 12, size: 8, r: 10, color: "butter" },
      ],
    },

    /* 2 · wishes in pictures */
    {
      bg: BG.gingham, title: ["wishes in ", "pictures"], titleBg: true,
      photos: [
        { img: "photo-03.jpg", x: 6, y: 15, w: 40, r: -4, cap: "make it a sweet one", clip: "pink",
          wish: "may your year be as sweet as this cake", wishSide: "left", wishColor: "pink" },
        { img: "photo-04.jpg", x: 52, y: 44, w: 40, r: 4, cap: "up, up & away", clip: "blue",
          wish: "may every wish float up & come true", wishColor: "blue" },
      ],
      texts: [
        { kind: "hand", text: "every picture holds a wish ♡", x: 52, y: 20, w: 42, size: 5, paper: true, r: 4 },
        { kind: "hand", text: "tap a photo to look closer", x: 4, y: 72, w: 44, size: 4.4, paper: "butter", r: -3 },
      ],
      stickers: [
        { shape: "star", x: 30, y: 88, size: 7, r: -10, color: "butter" },
        { shape: "heart", x: 90, y: 36, size: 6, r: 12, color: "pink" },
      ],
    },

    /* 3 · little moments */
    {
      bg: BG.bowPaper, title: ["little ", "moments"], accent: "#ffffff",
      photos: [
        { img: "photo-05.jpg", x: 54, y: 15, w: 40, r: 4, square: true, cap: "party animal", clip: "gold",
          wish: "may you never stop being this silly", wishSide: "left", wishColor: "butter" },
        { img: "photo-06.jpg", x: 8, y: 42, w: 40, r: -3, cap: "candlelight & cake", clip: "lilac",
          wish: "may your days be warm & full of light", wishColor: "lilac" },
      ],
      texts: [
        { kind: "hand", text: "remember this?", x: 8, y: 22, w: 40, size: 5.2, paper: "mint", r: -5 },
        { kind: "hand", text: "the small things, the best things", x: 54, y: 72, w: 42, color: "#4b5563" },
      ],
      stickers: [
        { shape: "moon", x: 84, y: 88, size: 7, r: 10, color: "butter" },
        { shape: "cloud", x: 66, y: 90, size: 9, color: "#ffffff" },
      ],
    },

    /* 4 · my wishes for you – torn paper strips */
    {
      bg: BG.damask, title: ["my wishes ", "for you"], accent: "#ffffff",
      photos: [
        { img: "photo-07.jpg", x: 50, y: 14, w: 42, r: 3, style: "print", clip: "gold" },
      ],
      texts: [
        { kind: "hand", text: "four wishes, all for you", x: 4, y: 28, w: 42, size: 6, color: "#ffffff", shadow: true, r: -5 },
        { kind: "hand", text: "may you laugh until your cheeks hurt", x: 6, y: 58, w: 88, size: 4.8, paper: true, r: -2 },
        { kind: "hand", text: "may every dream you chase come true", x: 6, y: 67, w: 88, size: 4.8, paper: "blue", r: 1.5 },
        { kind: "hand", text: "may you always feel as loved as you are", x: 6, y: 76, w: 88, size: 4.8, paper: "butter", r: -1 },
        { kind: "hand", text: "may the cake be big & the worries small", x: 6, y: 85, w: 88, size: 4.8, paper: "pink", r: 2 },
      ],
      stickers: [
        { shape: "star", x: 12, y: 49, size: 8, r: -12, color: "butter" },
        { shape: "heart", x: 38, y: 50, size: 6, r: 10, color: "pink" },
      ],
    },

    /* 5 · reasons i love you – three polaroids */
    {
      bg: BG.roses, title: ["reasons i ", "love you"], titleBg: true,
      photos: [
        { img: "photo-08.jpg", x: 6, y: 14, w: 30, r: -5, cap: "your laugh. obviously.", clip: "blue" },
        { img: "photo-09.jpg", x: 42, y: 20, w: 30, r: 4, cap: "you make hard days easy", clip: "pink" },
        { img: "photo-10.jpg", x: 14, y: 56, w: 30, r: -2, cap: "you remember little things", clip: "gold" },
      ],
      texts: [{ kind: "hand", text: "…and a hundred more", x: 52, y: 68, w: 40, size: 5.4, paper: "pink", r: 5 }],
      stickers: [
        { shape: "heart", x: 84, y: 22, size: 8, r: 12, color: "pink" },
        { shape: "heart", x: 66, y: 88, size: 6, r: -10, color: "blue" },
      ],
    },

    /* 6 · wishes from the squad – film strips */
    {
      bg: BG.kraft, title: ["wishes from ", "the squad"], titleBg: true,
      photos: [
        { img: "photo-11.jpg", x: 6, y: 14, w: 52, r: -3, style: "film", cap: "the boys, as always" },
        { img: "photo-12.jpg", x: 42, y: 47, w: 52, r: 3, style: "film", cap: "golden hour gang" },
      ],
      notes: [
        { text: "from the boys", secret: "happy birthday legend! drinks on you 🍻", x: 79, y: 15, r: 6, color: "butter", size: 28 },
        { text: "from your best friend", secret: "still can't believe you're getting old", x: 24, y: 64, r: -5, color: "mint", size: 28 },
      ],
      texts: [{ kind: "hand", text: "the people who love you", x: 46, y: 86, w: 48, size: 4.8, paper: true, r: -2 }],
    },

    /* 7 · wishes from the family – little letters */
    {
      bg: BG.damask, title: ["wishes from ", "the family"], titleBg: true,
      photos: [
        { img: "photo-13.jpg", x: 44, y: 14, w: 48, r: 3, style: "print", ratio: 0.9, clip: "silver",
          wish: "you make home feel like home", wishColor: "peach" },
      ],
      texts: [
        { kind: "hand", text: "home is wherever you are", x: 4, y: 26, w: 38, size: 6, r: -5 },
        { kind: "hand", text: "mom: so proud of who you've become ♡", x: 4, y: 61, w: 70, size: 4.8, paper: true, r: -2 },
        { kind: "hand", text: "dad: keep being exactly who you are", x: 22, y: 72, w: 70, size: 4.8, paper: "blue", r: 2 },
        { kind: "hand", text: "siblings: thanks for putting up with us", x: 4, y: 83, w: 72, size: 4.8, paper: "butter", r: -1.5 },
      ],
      stickers: [{ shape: "heart", x: 22, y: 46, size: 8, r: -8, color: "pink" }],
    },

    /* 8 · the year ahead – a photo for every season */
    {
      bg: BG.wash, title: ["the year ", "ahead"], titleBg: true,
      photos: [
        { img: "photo-14.jpg", x: 8, y: 15, w: 36, r: -4, square: true, cap: "spring: new roads", clip: "mint" },
        { img: "photo-15.jpg", x: 54, y: 16, w: 36, r: 3, square: true, cap: "summer: sunsets", clip: "butter" },
        { img: "photo-16.jpg", x: 10, y: 52, w: 36, r: 2, square: true, cap: "autumn: cosy days", clip: "peach" },
        { img: "photo-17.jpg", x: 54, y: 52, w: 36, r: -3, square: true, cap: "winter: city lights", clip: "lilac" },
      ],
      texts: [{ kind: "hand", text: "a wish for every season", x: 22, y: 89, w: 56, size: 4.8, paper: true, r: -1 }],
    },

    /* 9 · let your wishes fly */
    {
      bg: BG.gingham2, title: ["let your wishes ", "fly"], titleBg: true,
      models: [{ type: "balloons", x: 40, y: 86, count: 6, scale: 1.25, label: false }],
      texts: [
        { kind: "hand", text: "every balloon carries a wish for you", x: 56, y: 15, w: 40, size: 4.6, paper: true, r: 3 },
        { kind: "hand", text: "pop one & see ♡", x: 62, y: 48, w: 32, size: 5, paper: "pink", r: -4 },
        { kind: "hand", text: "wish big!", x: 66, y: 66, w: 26, size: 5.4, paper: "butter", r: 5 },
      ],
      stickers: [
        { shape: "star", x: 90, y: 32, size: 7, r: 12, color: "butter" },
        { shape: "heart", x: 88, y: 88, size: 8, r: -10, color: "pink" },
        { shape: "star", x: 78, y: 80, size: 5, r: 8, color: "blue" },
        { shape: "moon", x: 12, y: 30, size: 7, r: -8, color: "butter" },
      ],
    },

    /* 10 · make a wish */
    {
      bg: BG.bowSpark, title: ["make a ", "wish"],
      texts: [
        { kind: "hand", text: "tap the cake to blow out the candles", x: 0, y: 16, w: 100, color: "#7f9cbf" },
        { kind: "hand", text: "close your eyes & make a wish", x: 0, y: 88, w: 100, id: "wishMsg" },
        { kind: "hand", text: "make it a big one ☆", x: 4, y: 30, w: 26, size: 4.6, paper: "butter", r: -6 },
        { kind: "hand", text: "no peeking!", x: 70, y: 30, w: 24, size: 4.8, paper: "pink", r: 5 },
      ],
      models: [{ type: "cake", x: 50, y: 60, scale: 1.45, candles: 5, color: "blue" }],
      stickers: [
        { shape: "star", x: 12, y: 74, size: 8, r: -12, color: "butter" },
        { shape: "star", x: 88, y: 70, size: 7, r: 10, color: "blue" },
        { shape: "heart", x: 88, y: 90, size: 8, r: 8, color: "pink" },
        { shape: "moon", x: 14, y: 52, size: 7, r: -8, color: "butter" },
        { shape: "heart", x: 12, y: 90, size: 6, r: -8, color: "blue" },
        { shape: "star", x: 90, y: 50, size: 5, r: 14, color: "butter" },
      ],
    },

    /* 11 · open when… – notes under the stars */
    {
      bg: BG.night, title: ["open ", "when…"], ink: "#ffffff", accent: "#f6dc8a",
      notes: [
        { text: "when you're sad", secret: "you're loved. a lot. ☁", x: 26, y: 17, r: -5, color: "blue", size: 32 },
        { text: "when you miss me", secret: "i'm one text away ♡", x: 62, y: 33, r: 5, color: "butter", size: 32 },
        { text: "when you win", secret: "i knew you would 🏆", x: 28, y: 56, r: -3, color: "pink", size: 32 },
      ],
      texts: [{ kind: "hand", text: "little notes for any day", x: 0, y: 87, w: 100, color: "#ffffff", shadow: true }],
      stickers: [
        { shape: "moon", x: 82, y: 72, size: 10, r: 10, color: "butter" },
        { shape: "star", x: 64, y: 82, size: 6, r: -8, color: "butter" },
      ],
    },

    /* 12 · our memories */
    {
      bg: BG.script, title: ["our ", "memories"], titleBg: true,
      photos: [
        { img: "photo-18.jpg", x: 6, y: 15, w: 40, r: -3, cap: "chapter 1: the day we met", clip: "butter",
          wish: "here's to a hundred more chapters", wishSide: "left", wishColor: "mint" },
        { img: "photo-19.jpg", x: 52, y: 44, w: 40, r: 3, cap: "chapter 3: that crazy night", clip: "mint",
          wish: "may your life stay this loud & happy", wishColor: "peach" },
      ],
      texts: [
        { kind: "hand", text: "chapter 2: our first inside joke", x: 52, y: 20, w: 42, size: 4.8, paper: "butter", r: 4 },
        { kind: "hand", text: "chapter 4: today, still choosing you ☁", x: 4, y: 72, w: 44, size: 4.8, paper: "pink", r: -3 },
      ],
      stickers: [{ shape: "heart", x: 12, y: 91, size: 7, r: 10, color: "pink" }],
    },

    /* 13 · inside jokes */
    {
      bg: BG.gingham2, title: ["inside ", "jokes"], titleBg: true,
      photos: [
        { img: "photo-20.jpg", x: 8, y: 14, w: 54, r: -2, style: "film", cap: "the great pizza disaster 🍕" },
        { img: "photo-21.jpg", x: 52, y: 46, w: 40, r: 4, cap: "you know the one 😏", clip: "pink" },
      ],
      notes: [{ text: "our code word", secret: "shh… it's a secret 🤫", x: 28, y: 58, r: -6, color: "lilac", size: 28 }],
      texts: [{ kind: "hand", text: "if you know, you know", x: 66, y: 22, w: 30, size: 5.4, r: 6 }],
    },

    /* 14 · a gift for you */
    {
      bg: BG.bows, title: ["bonus ", "gift"],
      models: [{ type: "gift", x: 50, y: 62, scale: 2.6, color: "blue", ribbon: "pink" }],
      texts: [{ kind: "hand", text: "open the box! you're the best gift ♡", x: 18, y: 88, w: 64, size: 4.8, paper: true, r: -2 }],
      stickers: [
        { shape: "star", x: 14, y: 84, size: 8, r: -10, color: "butter" },
        { shape: "heart", x: 88, y: 86, size: 8, r: 10, color: "pink" },
      ],
    },

    /* 15 · all about you – favourites */
    {
      bg: BG.kraftRose, title: ["all about ", "you"], titleBg: true,
      photos: [
        { img: "photo-22.jpg", x: 8, y: 14, w: 32, r: -4, square: true, cap: "fav food: pizza", clip: "peach" },
        { img: "photo-23.jpg", x: 50, y: 16, w: 32, r: 4, square: true, cap: "fav thing: football", clip: "mint" },
        { img: "photo-24.jpg", x: 12, y: 50, w: 32, r: 3, square: true, cap: "fav place: the sea", clip: "blue" },
        { img: "photo-25.jpg", x: 52, y: 52, w: 32, r: -3, square: true, cap: "fav vibe: city nights", clip: "lilac" },
      ],
      texts: [{ kind: "hand", text: "things only i know", x: 24, y: 88, w: 52, size: 4.8, paper: true, r: 2 }],
    },

    /* 16 · bucket list – a checklist */
    {
      bg: BG.cream, title: ["bucket ", "list"],
      photos: [
        { img: "photo-26.jpg", x: 8, y: 14, w: 58, r: -2, style: "film", cap: "first stop: anywhere" },
      ],
      notes: [{ text: "this year", secret: "we actually do it ✈", x: 82, y: 18, r: 7, color: "pink", size: 24 }],
      texts: [
        { kind: "hand", text: "☐ a road trip somewhere new", x: 8, y: 56, w: 84, size: 5, paper: true, r: -1.5 },
        { kind: "hand", text: "☐ learn something totally random", x: 8, y: 65, w: 84, size: 5, paper: "mint", r: 1 },
        { kind: "hand", text: "☐ eat every dessert on the menu", x: 8, y: 74, w: 84, size: 5, paper: "butter", r: -1 },
        { kind: "hand", text: "☐ more of what makes you happy", x: 8, y: 83, w: 84, size: 5, paper: "blue", r: 1.5 },
      ],
    },

    /* 17 · the letter  ✎ write your birthday message here */
    {
      bg: BG.roses2, title: ["dear ", "you,"], titleBg: true,
      texts: [
        {
          kind: "letter", x: 12, y: 17, w: 76, align: "left", paper: true,
          text: "happy birthday! thank you for being the calm in my chaos, for every laugh, " +
                "every late-night talk and every quiet moment that felt like home. " +
                "i hope this year is as soft and kind to you as you are to everyone else.",
        },
        { kind: "hand", text: "— with love, always", x: 40, y: 66, w: 50, align: "right", color: "#7f9cbf" },
      ],
      notes: [{ text: "p.s.", secret: "you're stuck with me ♡", x: 62, y: 74, r: 7, color: "butter", size: 26 }],
      stickers: [{ shape: "heart", x: 18, y: 80, size: 10, r: -10, color: "pink" }],
    },

    /* 18 · a hug for you */
    {
      bg: BG.bowFlower, title: ["a hug ", "for you"], titleBg: true,
      models: [{ type: "teddy", x: 50, y: 62, scale: 2.2 }],
      texts: [{ kind: "hand", text: "give him a squeeze ♡", x: 26, y: 88, w: 48, size: 5, paper: true, r: -2 }],
      stickers: [
        { shape: "heart", x: 16, y: 30, size: 8, r: -10, color: "pink" },
        { shape: "heart", x: 84, y: 30, size: 8, r: 10, color: "blue" },
      ],
    },

    /* 19 · birthday quotes – on the night sky */
    {
      bg: BG.navy, title: ["birthday ", "quotes"], ink: "#ffffff", accent: "#f6dc8a",
      texts: [
        { kind: "hand", text: "age is just a number. you're still 17 at heart 😎", x: 10, y: 18, w: 70, size: 5.2, paper: true, r: -3 },
        { kind: "hand", text: "you don't get older, you level up", x: 20, y: 38, w: 72, size: 5.2, paper: "blue", r: 2 },
        { kind: "hand", text: "the best is yet to come", x: 8, y: 54, w: 60, size: 5.2, paper: "butter", r: -2 },
        { kind: "hand", text: "cake is always the answer 🎂", x: 26, y: 70, w: 64, size: 5.2, paper: "pink", r: 3 },
        { kind: "hand", text: "words to live by", x: 0, y: 88, w: 100, color: "#ffffff", shadow: true },
      ],
      stickers: [
        { shape: "star", x: 86, y: 54, size: 7, r: 12, color: "butter" },
        { shape: "moon", x: 14, y: 82, size: 8, r: -10, color: "butter" },
      ],
    },

    /* 20 · finale – fireworks; the button reads the album again */
    {
      bg: BG.night,
      texts: [
        { kind: "cover", text: "happy", x: 0, y: 26, w: 100, size: 20 },
        { kind: "cover", text: "birthday", italic: true, x: 0, y: 39, w: 100, size: 20 },
        { kind: "hand", text: "{name} ♡", x: 0, y: 55, w: 100, color: "#ffffff", shadow: true },
        { kind: "hand", text: "here's to you & another beautiful year ☁", x: 8, y: 64, w: 84, color: "#ffffff", shadow: true },
        { kind: "button", text: "read again ↺", x: 50, y: 80, action: "again" },
      ],
      stickers: [
        { shape: "star", x: 20, y: 16, size: 9, r: -10, color: "butter" },
        { shape: "heart", x: 80, y: 18, size: 9, r: 10, color: "pink" },
        { shape: "cloud", x: 82, y: 92, size: 12, color: "#ffffff" },
      ],
    },

    /* 21 · BACK COVER – the same board, with no photo window */
    {
      bg: BG.cream,
      cover: {
        paper: BG.gingham,
        top: "the end",
        title: ["made with", "love"],
        name: "— {from}",
        foot: "happy birthday ♡",
      },
    },
  ],
};
