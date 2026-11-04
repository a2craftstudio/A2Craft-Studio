/* Where each order's data comes from (one place for every birthday book). Leave `url` empty to use only the static data in pages.js.
   The order id comes from the link: index.html?order=1234  (see remote.js for the JSON format). */
window.BOOK_API = {
  url: "",                // e.g. "https://api.example.com/birthday-books/{order}"  ({order} is replaced by the id)
  orderParam: "order",    // the name of the link parameter that carries the order id
  timeout: 4000,          // milliseconds to wait for the API before falling back to the static data
  headers: {},            // e.g. { Authorization: "Bearer …" }
  brand: { text: "", url: "" },   // at "the end": a link to make a book for someone else (hidden while url is empty)
  direct: false,          // false: API pictures load through the wsrv.nl proxy (works for any host);
                          // true: load them directly (the picture server must allow CORS)
};
