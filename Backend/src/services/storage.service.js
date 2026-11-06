
const ImageKit = require("@imagekit/nodejs");
const { toFile } = require("@imagekit/nodejs");

const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

// Safe filename
const safeName = (name = "image.jpg") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "image.jpg";

// Upload image
async function uploadFile(buffer, originalName, mimeType) {
  const result = await imagekit.files.upload({
    // A multipart file avoids the 33% payload expansion of converting the image to base64.
    file: await toFile(buffer, safeName(originalName), { type: mimeType }),
    fileName: safeName(originalName),
    folder: "/posts",
    useUniqueFileName: true,
  });

  return {
    url: result.url,
    fileId: result.fileId,
  };
}

// Delete image from ImageKit
async function deleteFile(fileId) {
  if (!fileId) {
    throw new Error("ImageKit fileId is required");
  }

  return await imagekit.files.delete(fileId);
}

module.exports = {
  uploadFile,
  deleteFile,
};
