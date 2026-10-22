const ImageKit = require("@imagekit/nodejs");

const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

// file name ko safe banao (sirf letters, numbers, . _ -)
const safeName = (name = "image.jpg") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "image.jpg";

async function uploadFile(buffer, originalName) {
  const result = await imagekit.files.upload({
    file: buffer.toString("base64"),
    fileName: safeName(originalName),
    folder: "/posts",
    useUniqueFileName: true, // same naam ki file overwrite nahi hogi
  });
  return result;
}

module.exports = uploadFile;