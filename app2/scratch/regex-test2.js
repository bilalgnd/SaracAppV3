const content = "spotify key:\r\nbbfb8b958bde4c07a45c2873ca3c0051\r\nspotify secret:\r\n60e2340ef4ac4006bafe2643fbdb004a\r\n\r\ntrendyol:\r\nSupplier ID: 6647850\r\nAPI Key: bYv2F8LWu5QAHfucbind \r\nAPI Secret: zCFUGzkEL4kjXkdZ9ZRN";

console.log("OLD REGEX:", content.match(/spotify key:\s*\r?\n([a-zA-Z0-9]+)/i));
console.log("NEW REGEX:", content.match(/spotify key:\s*([a-zA-Z0-9]+)/i));
