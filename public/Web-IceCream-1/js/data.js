// Menu data shared by every page
const CATEGORIES = [
  { id: "icecream", name: "Ice Cream", icon: "ice-cream", color: "#ff6b9a", cover: "img/ic-strawberry-cone.jpg", blurb: "Hand-churned scoops & cones" },
  { id: "falooda", name: "Falooda", icon: "pint-glass", color: "#e0245e", cover: "img/fa-kesar.jpg", blurb: "Rose, kesar & royal layers" },
  { id: "gola", name: "Ice Gola", icon: "snowflake", color: "#22b8cf", cover: "img/go-rainbow.jpg", blurb: "Shaved ice, syrup-soaked" },
  { id: "kulfi", name: "Kulfi & Pops", icon: "popsicle", color: "#ffa41b", cover: "img/ku-mango.jpg", blurb: "Matka kulfi & fruit pops" },
  { id: "chocolate", name: "Chocolates", icon: "cookie", color: "#7a4330", cover: "img/ch-truffles.jpg", blurb: "Truffles, bars & gift boxes" },
  { id: "shakes", name: "Shakes", icon: "martini", color: "#9b5de5", cover: "img/sh-oreo.jpg", blurb: "Thick shakes & freakshakes" },
  { id: "sundaes", name: "Sundaes", icon: "bowl-food", color: "#f15bb5", cover: "img/su-hot-fudge.jpg", blurb: "Towering glass sundaes" },
  { id: "hotchoc", name: "Hot Chocolate", icon: "coffee", color: "#8b5a2b", cover: "img/ho-marshmallow.jpg", blurb: "Velvety cocoa mugs" },
  { id: "bakes", name: "Waffles & Brownies", icon: "cake", color: "#c47f2c", cover: "img/ba-strawberry-waffle.jpg", blurb: "Warm bakes, cold scoops" },
  { id: "indian", name: "Indian Sweets", icon: "flower-lotus", color: "#e76f51", cover: "img/in-gulab-jamun.jpg", blurb: "Mithai made the desi way" },
];

const MENU = [
  // Ice cream
  { id: "ic1", cat: "icecream", name: "Strawberry Swirl Cone", desc: "Fresh strawberry & vanilla twist on a crisp waffle cone.", price: 129, img: "img/ic-strawberry-cone.jpg", tag: "Bestseller", rating: 4.9 },
  { id: "ic2", cat: "icecream", name: "Double Chocolate Cone", desc: "Belgian cocoa scoop loaded with chocolate shavings.", price: 149, img: "img/ic-chocolate-cone.jpg", rating: 4.8 },
  { id: "ic3", cat: "icecream", name: "Sprinkle Party Cone", desc: "Tutti-frutti scoop rolled in rainbow sprinkles.", price: 119, img: "img/ic-sprinkle-cone.jpg", tag: "Kids' fav", rating: 4.7 },
  { id: "ic4", cat: "icecream", name: "Berry Patch Cones (x3)", desc: "Three mini cones with mixed berry scoops.", price: 249, img: "img/ic-berry-cones.jpg", rating: 4.8 },
  { id: "ic5", cat: "icecream", name: "Pista Badam Scoop", desc: "Roasted pistachio & almond in a waffle basket.", price: 159, img: "img/ic-pista.jpg", tag: "New", rating: 4.6 },
  { id: "ic6", cat: "icecream", name: "Celebration Cone Box", desc: "Five assorted cones — made for sharing.", price: 399, img: "img/ic-party-cones.jpg", rating: 4.9 },

  // Falooda
  { id: "fa1", cat: "falooda", name: "Royal Rose Falooda", desc: "Rose syrup, sabja, vermicelli, milk & a scoop of kulfi.", price: 189, img: "img/fa-royal-rose.jpg", tag: "Signature", rating: 4.9 },
  { id: "fa2", cat: "falooda", name: "Kesar Pista Falooda", desc: "Saffron milk, pistachio crunch & malai ice cream.", price: 209, img: "img/fa-kesar.jpg", rating: 4.8 },
  { id: "fa3", cat: "falooda", name: "Strawberry Falooda", desc: "Strawberry crush layered with jelly and cream.", price: 199, img: "img/fa-strawberry.jpg", tag: "New", rating: 4.7 },
  { id: "fa4", cat: "falooda", name: "Classic Mumbai Falooda", desc: "The old-school favourite, just like Mohammed Ali Road.", price: 169, img: "img/fa-classic.jpg", rating: 4.8 },
  { id: "fa5", cat: "falooda", name: "Falooda Duo Pack", desc: "Two glasses of any falooda — perfect for dates.", price: 339, img: "img/fa-duo.jpg", rating: 4.7 },

  // Gola
  { id: "go1", cat: "gola", name: "Blue Raspberry Gola", desc: "Fluffy shaved ice with tangy blue raspberry syrup.", price: 79, img: "img/go-blue.jpg", rating: 4.6 },
  { id: "go2", cat: "gola", name: "Rainbow Kala Khatta", desc: "Kala khatta, orange & rose — a full rainbow of syrups.", price: 99, img: "img/go-rainbow.jpg", tag: "Bestseller", rating: 4.9 },
  { id: "go3", cat: "gola", name: "Alphonso Mango Gola", desc: "Mango pulp, mango syrup & a cloud of malai.", price: 119, img: "img/go-mango.jpg", tag: "Seasonal", rating: 4.8 },
  { id: "go4", cat: "gola", name: "Strawberry Snow Gola", desc: "Strawberry syrup with condensed milk drizzle.", price: 89, img: "img/go-strawberry.jpg", rating: 4.6 },
  { id: "go5", cat: "gola", name: "Malai Dry Fruit Gola", desc: "Bingsu-style ice with malai, nuts & fresh berries.", price: 149, img: "img/go-malai.jpg", rating: 4.8 },

  // Kulfi & pops
  { id: "ku1", cat: "kulfi", name: "Mango Matka Kulfi", desc: "Slow-cooked milk with Alphonso mango on a stick.", price: 69, img: "img/ku-mango.jpg", tag: "Bestseller", rating: 4.9 },
  { id: "ku2", cat: "kulfi", name: "Rose Raspberry Kulfi", desc: "Gulkand kulfi studded with real raspberries.", price: 79, img: "img/ku-rose.jpg", rating: 4.7 },
  { id: "ku3", cat: "kulfi", name: "Strawberry Cream Pops", desc: "Creamy strawberry popsicles, pack of three.", price: 149, img: "img/ku-strawberry.jpg", rating: 4.6 },
  { id: "ku4", cat: "kulfi", name: "Rocket Ice Pop", desc: "Cherry, lemon & blue raspberry rocket.", price: 49, img: "img/ku-rocket.jpg", tag: "Kids' fav", rating: 4.5 },
  { id: "ku5", cat: "kulfi", name: "Fruit Punch Pops (x4)", desc: "Orange, mango, kokum & guava ice pops.", price: 169, img: "img/ku-fruit.jpg", rating: 4.7 },

  // Chocolates
  { id: "ch1", cat: "chocolate", name: "Classic Truffle Dozen", desc: "Twelve dark ganache truffles dusted in cocoa.", price: 449, img: "img/ch-truffles.jpg", tag: "Gift pick", rating: 4.9 },
  { id: "ch2", cat: "chocolate", name: "Sprinkle Truffle Tray", desc: "Milk chocolate truffles with candy sprinkles.", price: 399, img: "img/ch-sprinkle-truffles.jpg", rating: 4.7 },
  { id: "ch3", cat: "chocolate", name: "Assorted Bonbons", desc: "Hazelnut, caramel, coffee & orange bonbons.", price: 499, img: "img/ch-assorted.jpg", rating: 4.8 },
  { id: "ch4", cat: "chocolate", name: "Celebration Gift Box", desc: "Luxury box of 16 handmade chocolates.", price: 899, img: "img/ch-gift-box.jpg", tag: "Premium", rating: 4.9 },
  { id: "ch5", cat: "chocolate", name: "70% Dark Bar", desc: "Single-origin dark chocolate with sea salt.", price: 199, img: "img/ch-dark-bar.jpg", rating: 4.6 },

  // Shakes
  { id: "sh1", cat: "shakes", name: "Oreo Overload Shake", desc: "Thick vanilla shake blended with crushed Oreos.", price: 179, img: "img/sh-oreo.jpg", tag: "Bestseller", rating: 4.9 },
  { id: "sh2", cat: "shakes", name: "Fresh Strawberry Shake", desc: "Real strawberries, cold milk & vanilla ice cream.", price: 159, img: "img/sh-strawberry.jpg", rating: 4.7 },
  { id: "sh3", cat: "shakes", name: "Cold Coffee Frappe", desc: "Espresso, chocolate drizzle & whipped cream.", price: 169, img: "img/sh-cold-coffee.jpg", rating: 4.8 },
  { id: "sh4", cat: "shakes", name: "Vanilla Bean Shake", desc: "Old-fashioned diner vanilla with candy cane.", price: 149, img: "img/sh-vanilla.jpg", rating: 4.6 },
  { id: "sh5", cat: "shakes", name: "Chocolate Freakshake", desc: "Brownie, wafers & fudge piled on a mason jar.", price: 249, img: "img/sh-freak.jpg", tag: "Insta hit", rating: 4.9 },

  // Sundaes
  { id: "su1", cat: "sundaes", name: "Hot Fudge Sundae", desc: "Vanilla, hot fudge, Oreo & wafer rolls.", price: 219, img: "img/su-hot-fudge.jpg", tag: "Signature", rating: 4.9 },
  { id: "su2", cat: "sundaes", name: "Salted Caramel Sundae", desc: "Caramel scoops with butterscotch crunch.", price: 199, img: "img/su-caramel.jpg", rating: 4.7 },
  { id: "su3", cat: "sundaes", name: "Choco Chip Tower", desc: "Chocolate chip ice cream, fudge & whipped cream.", price: 229, img: "img/su-choco-chip.jpg", rating: 4.8 },
  { id: "su4", cat: "sundaes", name: "Funfetti Sundae", desc: "Birthday-cake ice cream with sprinkle shower.", price: 189, img: "img/su-funfetti.jpg", tag: "Kids' fav", rating: 4.7 },

  // Hot chocolate
  { id: "ho1", cat: "hotchoc", name: "Marshmallow Hot Choc", desc: "Rich cocoa topped with toasted marshmallows.", price: 159, img: "img/ho-marshmallow.jpg", tag: "Winter fav", rating: 4.8 },
  { id: "ho2", cat: "hotchoc", name: "Molten Pour Cocoa", desc: "Melted chocolate poured fresh at your table.", price: 179, img: "img/ho-pour.jpg", rating: 4.9 },
  { id: "ho3", cat: "hotchoc", name: "Dark Espresso Cocoa", desc: "70% dark chocolate with a shot of espresso.", price: 169, img: "img/ho-dark.jpg", rating: 4.6 },

  // Bakes
  { id: "ba1", cat: "bakes", name: "Brownie Sizzler", desc: "Sizzling brownie, vanilla scoop & hot chocolate.", price: 229, img: "img/ba-brownie-sizzler.jpg", tag: "Bestseller", rating: 4.9 },
  { id: "ba2", cat: "bakes", name: "Fudge Brownie Stack", desc: "Three gooey brownies drenched in ganache.", price: 189, img: "img/ba-fudge-brownie.jpg", rating: 4.8 },
  { id: "ba3", cat: "bakes", name: "Strawberry Belgian Waffle", desc: "Crisp waffle, strawberries & powdered sugar.", price: 199, img: "img/ba-strawberry-waffle.jpg", rating: 4.7 },
  { id: "ba4", cat: "bakes", name: "Waffle & Scoop", desc: "Warm waffle with a vanilla bean scoop.", price: 179, img: "img/ba-waffle-scoop.jpg", rating: 4.7 },
  { id: "ba5", cat: "bakes", name: "Death by Chocolate Cake", desc: "Layered mousse cake with ganache drip (slice).", price: 209, img: "img/ba-choco-cake.jpg", tag: "Rich", rating: 4.8 },
  { id: "ba6", cat: "bakes", name: "Black Forest Slice", desc: "Cherries, cream & chocolate sponge.", price: 179, img: "img/ba-forest-cake.jpg", rating: 4.7 },

  // Indian sweets
  { id: "in1", cat: "indian", name: "Gulab Jamun (4 pc)", desc: "Warm, syrupy jamuns — great with vanilla scoop.", price: 99, img: "img/in-gulab-jamun.jpg", tag: "Desi fav", rating: 4.9 },
  { id: "in2", cat: "indian", name: "Mithai Celebration Box", desc: "Kaju katli, barfi, laddoo & more (500 g).", price: 549, img: "img/in-sweet-shop.jpg", rating: 4.8 },
];

const findItem = (id) => MENU.find((m) => m.id === id);
const findCat = (id) => CATEGORIES.find((c) => c.id === id);

// ---------- People & story ----------
// Swap these photos for your own: drop files in img/ and update the paths.
const TEAM = [
  { name: "Ramesh “Dada” Mehta", role: "Founder · Gola maestro", img: "img/team-dada.jpg", years: 42, fav: "Kala khatta gola", quote: "Ice, syrup and a smile — that's the whole recipe." },
  { name: "Sunita Mehta", role: "Kulfi & falooda queen", img: "img/team-sunita.jpg", years: 30, fav: "Kesar pista falooda", quote: "Milk must simmer slowly, like a good story." },
  { name: "Vikram Mehta", role: "Head of chocolate", img: "img/team-vikram.jpg", years: 14, fav: "Classic truffle", quote: "Tempering chocolate is my meditation." },
  { name: "Anil Kumar", role: "Head chef", img: "img/team-anil.jpg", years: 11, fav: "Brownie sizzler", quote: "If it doesn't sizzle, it's not done." },
  { name: "Priya Nair", role: "Store manager, Juhu", img: "img/team-priya.jpg", years: 8, fav: "Mango matka kulfi", quote: "Every guest leaves with a sweet memory." },
  { name: "Farhan Shaikh", role: "Shake & sundae artist", img: "img/team-farhan.jpg", years: 5, fav: "Chocolate freakshake", quote: "More toppings. Always more toppings." },
  { name: "Meera Joshi", role: "Customer happiness", img: "img/team-meera.jpg", years: 4, fav: "Vanilla rose", quote: "Your birthday scoop? I've got it covered." },
  { name: "Arjun Rao", role: "Delivery captain", img: "img/team-arjun.jpg", years: 3, fav: "Oreo overload", quote: "Frozen at your door in 30 minutes." },
];

const MEMORIES = [
  { img: "img/memory-family-1960.jpg", year: "1968", caption: "The whole Mehta clan on opening day of Dada's first cart" },
  { img: "img/memory-dad-daughter.jpg", year: "1974", caption: "Little Sunita's first gola — rose, of course" },
  { img: "img/memory-grandparents.jpg", year: "1979", caption: "Dadi & Dada with the neighbours who never paid" },
  { img: "img/memory-brothers.jpg", year: "1986", caption: "Vikram & cousin taste-testing the new kulfi" },
  { img: "img/memory-living-room.jpg", year: "1991", caption: "Sunday kulfi nights in the old Juhu flat" },
  { img: "img/memory-picnic.jpg", year: "1995", caption: "Monsoon picnic — the cart came too" },
  { img: "img/memory-grandma.jpg", year: "2004", caption: "Sunita with the grandkids, our toughest critics" },
  { img: "img/memory-mother.jpg", year: "2012", caption: "Opening the first real Sweet Drip parlour" },
];

const INGREDIENTS = [
  { name: "Farm-fresh milk", img: "img/ing-milk.jpg", icon: "drop", amount: "1,200 L", per: "every week", pct: 96, note: "From 3 family dairies near Vasai" },
  { name: "Strawberries", img: "img/ing-strawberry.jpg", icon: "heart", amount: "180 kg", per: "every week", pct: 72, note: "Mahabaleshwar, picked in season" },
  { name: "Alphonso mango", img: "img/ing-mango.jpg", icon: "sun", amount: "2,400", per: "mangoes a month", pct: 64, note: "Devgad Hapus, April to June" },
  { name: "Cocoa beans", img: "img/ing-cocoa.jpg", icon: "cookie", amount: "90 kg", per: "every week", pct: 58, note: "Single-origin from Idukki, Kerala" },
  { name: "Pistachios", img: "img/ing-pistachio.jpg", icon: "plant", amount: "40 kg", per: "every week", pct: 45, note: "Roasted in-house every morning" },
  { name: "Kashmiri saffron", img: "img/ing-saffron.jpg", icon: "flower-lotus", amount: "120 g", per: "every week", pct: 30, note: "A few strands in every kesar treat" },
];

const MOMENTS = [
  { img: "img/couple-share.jpg", tag: "couples", name: "Kabir & Ananya", caption: "First date, one cone, two spoons… wait, no spoons.", likes: 482 },
  { img: "img/kid-blue-scoop.jpg", tag: "kids", name: "Little Zoya", caption: "Blue raspberry everywhere. Worth it.", likes: 351 },
  { img: "img/couple-laugh.jpg", tag: "couples", name: "Rhea & Sam", caption: "Anniversary #3 — still fighting over the last bite.", likes: 298 },
  { img: "img/moment-friends.jpg", tag: "friends", name: "The Bandra Gang", caption: "Cheers with cones after finals!", likes: 264 },
  { img: "img/kid-big-cone.jpg", tag: "kids", name: "Aarav, 9", caption: "Ordered the biggest cone. Finished it. Legend.", likes: 240 },
  { img: "img/couple-steps.jpg", tag: "couples", name: "Neha & Rohit", caption: "Our Sunday ritual on the Colaba steps.", likes: 221 },
  { img: "img/memory-dad-daughter.jpg", tag: "family", name: "The Mehtas", caption: "Where it all began, 1974.", likes: 410 },
  { img: "img/moment-sunset-cone.jpg", tag: "friends", name: "Tanvi", caption: "Mango scoop + Juhu sunset = perfect evening.", likes: 189 },
  { img: "img/kid-toddler.jpg", tag: "kids", name: "Baby Ira", caption: "First ever ice cream. Face says it all.", likes: 512 },
  { img: "img/couple-counter.jpg", tag: "couples", name: "Dev & Maya", caption: "Proposed right here at the counter. She said yes!", likes: 634 },
  { img: "img/moment-truck.jpg", tag: "friends", name: "Weekend crew", caption: "Chasing the Sweet Drip truck at the food fest.", likes: 176 },
  { img: "img/kid-pop.jpg", tag: "kids", name: "Sara", caption: "Rocket pop = rocket fuel.", likes: 205 },
  { img: "img/memory-grandma.jpg", tag: "family", name: "Joshi family", caption: "Three generations, one table, nine kulfis.", likes: 318 },
  { img: "img/couple-sunset.jpg", tag: "couples", name: "Ishaan & Tara", caption: "Golas and golden hour.", likes: 287 },
  { img: "img/kid-arch.jpg", tag: "family", name: "Twins Aryan & Anya", caption: "Matching cones, matching smiles.", likes: 263 },
  { img: "img/kid-blonde.jpg", tag: "kids", name: "Leo", caption: "Concentration level: maximum.", likes: 158 },
];

const FAQS = [
  { q: "Do you deliver golas without them melting?", a: "Yes! Golas travel in insulated boxes with the syrup packed separately, so you pour it fresh at home." },
  { q: "Is everything vegetarian?", a: "Our kitchen is 100% vegetarian and most items are eggless — look for the eggless tag on the menu." },
  { q: "Can I book a gola counter for my wedding or party?", a: "Absolutely. We bring the shaver, 12 syrups, toppings and a server for events of 50+ guests." },
  { q: "Do you have sugar-free options?", a: "Sugar-free kulfi, 70% dark chocolate and stevia-sweetened shakes are available at every parlour." },
  { q: "Can I bring my pet?", a: "Our Juhu and Bandra parlours have outdoor seating where pets are welcome — we even have a dog-friendly 'pupsicle'." },
  { q: "How long does delivery take?", a: "Usually 25–35 minutes within 6 km of any parlour. Orders above ₹499 ship free." },
  { q: "Do you make custom cakes or chocolate hampers?", a: "Yes — give us 48 hours for custom ice-cream cakes and chocolate gift hampers." },
];

// ---------- Parlours (real Mumbai locations for the map) ----------
// hours: [open, close] in 24h; a close past midnight is written as 25 = 1 AM
const BRANCHES = [
  { id: "juhu", name: "Juhu Beach", tag: "The original", address: "Shop 4, Juhu Tara Rd, near Juhu Beach, Mumbai 400049", lat: 19.099, lng: 72.8265, phone: "+919876543210", hours: [11, 25], img: "img/shop-front.jpg", perks: ["Seating", "Pets welcome", "Gola Lab"] },
  { id: "bandra", name: "Bandra West", tag: "Neon cone", address: "Shop 12, Hill Road, Bandra West, Mumbai 400050", lat: 19.0553, lng: 72.8323, phone: "+919876543211", hours: [11, 24], img: "img/shop-interior.jpg", perks: ["Seating", "Parking", "Wi-Fi"] },
  { id: "colaba", name: "Colaba Causeway", tag: "Retro booths", address: "Shop 7, Colaba Causeway, Colaba, Mumbai 400005", lat: 18.9182, lng: 72.8281, phone: "+919876543212", hours: [12, 24], img: "img/shop-diner.jpg", perks: ["Seating", "Takeaway"] },
  { id: "andheri", name: "Lokhandwala, Andheri", tag: "Late night", address: "Shop 3, Lokhandwala Market, Andheri West, Mumbai 400053", lat: 19.1418, lng: 72.8256, phone: "+919876543213", hours: [11, 25], img: "img/shop-counter.jpg", perks: ["Takeaway", "Delivery hub"] },
  { id: "powai", name: "Hiranandani, Powai", tag: "Lakeside", address: "Shop 9, Hiranandani Gardens, Powai, Mumbai 400076", lat: 19.1176, lng: 72.9091, phone: "+919876543214", hours: [12, 23], img: "img/shop-serving.jpg", perks: ["Seating", "Kids corner", "Parking"] },
  { id: "dadar", name: "Shivaji Park, Dadar", tag: "Family favourite", address: "Shop 2, Shivaji Park Rd, Dadar West, Mumbai 400028", lat: 19.027, lng: 72.8383, phone: "+919876543215", hours: [11, 23], img: "img/shop-neon.jpg", perks: ["Takeaway", "Seating"] },
];

// Photo sizes so pins can reserve their space while images load
const IMG_SIZES = {"img/ba-brownie-sizzler.jpg":[600,800],"img/ba-brownie-tray.jpg":[543,800],"img/ba-choco-cake.jpg":[532,800],"img/ba-forest-cake.jpg":[693,800],"img/ba-fudge-brownie.jpg":[533,800],"img/ba-strawberry-waffle.jpg":[600,800],"img/ba-waffle-berry.jpg":[640,800],"img/ba-waffle-scoop.jpg":[800,533],"img/ch-assorted.jpg":[800,450],"img/ch-dark-bar.jpg":[533,800],"img/ch-gift-box.jpg":[640,800],"img/ch-sprinkle-truffles.jpg":[600,800],"img/ch-truffles.jpg":[600,800],"img/couple-counter.jpg":[800,400],"img/couple-laugh.jpg":[800,533],"img/couple-share.jpg":[800,531],"img/couple-steps.jpg":[800,751],"img/couple-sunset.jpg":[800,533],"img/fa-classic.jpg":[600,800],"img/fa-duo.jpg":[800,500],"img/fa-kesar.jpg":[600,800],"img/fa-royal-rose.jpg":[800,500],"img/fa-strawberry.jpg":[600,800],"img/face-1.jpg":[533,800],"img/face-2.jpg":[533,800],"img/face-3.jpg":[623,800],"img/go-blue.jpg":[800,533],"img/go-malai.jpg":[534,800],"img/go-mango.jpg":[800,535],"img/go-rainbow.jpg":[533,800],"img/go-strawberry.jpg":[800,533],"img/gola-base.jpg":[760,760],"img/ho-dark.jpg":[800,533],"img/ho-marshmallow.jpg":[533,800],"img/ho-pour.jpg":[533,800],"img/ic-berry-cones.jpg":[640,800],"img/ic-chocolate-cone.jpg":[640,800],"img/ic-party-cones.jpg":[800,533],"img/ic-pista.jpg":[800,503],"img/ic-sprinkle-cone.jpg":[800,610],"img/ic-strawberry-cone.jpg":[533,800],"img/in-gulab-jamun.jpg":[534,800],"img/in-sweet-shop.jpg":[603,800],"img/ing-cocoa.jpg":[641,800],"img/ing-mango.jpg":[600,800],"img/ing-milk-bottles.jpg":[800,800],"img/ing-milk.jpg":[533,800],"img/ing-pistachio.jpg":[532,800],"img/ing-saffron.jpg":[800,533],"img/ing-strawberry.jpg":[634,800],"img/kid-arch.jpg":[533,800],"img/kid-big-cone.jpg":[533,800],"img/kid-blonde.jpg":[533,800],"img/kid-blue-scoop.jpg":[800,533],"img/kid-cone-white.jpg":[800,533],"img/kid-pop.jpg":[800,533],"img/kid-toddler.jpg":[533,800],"img/ku-fruit.jpg":[800,533],"img/ku-mango.jpg":[800,533],"img/ku-rocket.jpg":[533,800],"img/ku-rose.jpg":[800,791],"img/ku-strawberry.jpg":[627,800],"img/memory-brothers.jpg":[800,644],"img/memory-dad-daughter.jpg":[539,800],"img/memory-family-1960.jpg":[800,592],"img/memory-grandma.jpg":[800,550],"img/memory-grandparents.jpg":[631,800],"img/memory-living-room.jpg":[800,533],"img/memory-mother.jpg":[800,533],"img/memory-picnic.jpg":[800,600],"img/moment-friends.jpg":[533,800],"img/moment-sunset-cone.jpg":[533,800],"img/moment-truck.jpg":[533,800],"img/pl-gelato-counter.jpg":[800,600],"img/pl-hand-cone.jpg":[533,800],"img/pl-scoop-counter.jpg":[800,533],"img/pl-store.jpg":[800,533],"img/pl-tubs.jpg":[800,534],"img/sh-cold-coffee.jpg":[533,800],"img/sh-freak.jpg":[549,800],"img/sh-oreo.jpg":[533,800],"img/sh-strawberry.jpg":[800,533],"img/sh-vanilla.jpg":[481,800],"img/shop-cones.jpg":[800,533],"img/shop-counter.jpg":[800,533],"img/shop-diner.jpg":[533,800],"img/shop-front.jpg":[800,600],"img/shop-interior.jpg":[531,800],"img/shop-neon.jpg":[600,800],"img/shop-serving.jpg":[800,533],"img/shop-tubs.jpg":[800,534],"img/su-caramel.jpg":[533,800],"img/su-choco-chip.jpg":[532,800],"img/su-funfetti.jpg":[640,800],"img/su-hot-fudge.jpg":[533,800],"img/team-anil.jpg":[800,533],"img/team-arjun.jpg":[800,533],"img/team-dada.jpg":[800,573],"img/team-farhan.jpg":[533,800],"img/team-meera.jpg":[800,534],"img/team-priya.jpg":[533,800],"img/team-sunita.jpg":[533,800],"img/team-vikram.jpg":[800,800]};
