const crypto = require("crypto");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const multer = require("multer");
const AppError = require("../utils/appError");

const AUDIO_MAX_SIZE = 20 * 1024 * 1024;
const COVER_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

const uploadRoot = path.join(__dirname, "../../uploads");
const audioUploadPath = path.join(uploadRoot, "audio");
const coverUploadPath = path.join(uploadRoot, "covers");
const avatarUploadPath = path.join(uploadRoot, "avatars");

fs.mkdirSync(audioUploadPath, { recursive: true });
fs.mkdirSync(coverUploadPath, { recursive: true });
fs.mkdirSync(avatarUploadPath, { recursive: true });

const audioMimeTypes = new Set(["audio/mpeg", "audio/mp3"]);
const coverMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const audioExtensions = new Set([".mp3"]);
const coverExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const avatarExtensions = coverExtensions;

const isAudioField = (fieldName) => {
  return fieldName === "audio" || fieldName === "audio_file";
};

const isCoverField = (fieldName) => {
  return fieldName === "cover" || fieldName === "cover_image";
};

const getAudioExtension = (mimetype) => {
  if (!audioMimeTypes.has(mimetype)) {
    return null;
  }

  return ".mp3";
};

const getCoverExtension = (mimetype) => {
  return coverMimeTypes.get(mimetype) || null;
};

const getOriginalExtension = (file) => {
  return path.extname(file.originalname || "").toLowerCase();
};

const removeUploadedFile = async (file) => {
  if (!file?.path) {
    return;
  }

  await fsPromises.unlink(file.path).catch(() => {});
};

const removeUploadedFiles = async (files = []) => {
  await Promise.all(files.map((file) => removeUploadedFile(file)));
};

const getUploadedFile = (req, fieldName, aliases = []) => {
  const fieldNames = [fieldName, ...aliases];

  for (const currentFieldName of fieldNames) {
    const files = req.files?.[currentFieldName];

    if (Array.isArray(files) && files.length > 0) {
      return files[0];
    }
  }

  return null;
};

const readFileHeader = async (filePath, byteLength = 12) => {
  const handle = await fsPromises.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(byteLength);
    const { bytesRead } = await handle.read(buffer, 0, byteLength, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const isMp3Header = (header) => {
  const hasId3Tag =
    header.length >= 3 &&
    header[0] === 0x49 &&
    header[1] === 0x44 &&
    header[2] === 0x33;
  const hasMpegFrame =
    header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0;

  return hasId3Tag || hasMpegFrame;
};

const isJpegHeader = (header) => {
  return (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  );
};

const isPngHeader = (header) => {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  return header.length >= 8 && header.subarray(0, 8).equals(pngSignature);
};

const isWebpHeader = (header) => {
  return (
    header.length >= 12 &&
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP"
  );
};

const isCoverHeader = (header) => {
  return isJpegHeader(header) || isPngHeader(header) || isWebpHeader(header);
};

const createStorage = (destination, getExtension) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const extension = getExtension(file.mimetype);
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  });
};

const createTrackStorage = () => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      if (isAudioField(file.fieldname)) {
        return cb(null, audioUploadPath);
      }

      if (isCoverField(file.fieldname)) {
        return cb(null, coverUploadPath);
      }

      return cb(new AppError("Invalid file field. Use audio/audio_file and cover/cover_image", 400));
    },
    filename: (req, file, cb) => {
      const extension =
        isAudioField(file.fieldname)
          ? getAudioExtension(file.mimetype)
          : getCoverExtension(file.mimetype);

      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  });
};

const createAvatarStorage = () => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarUploadPath);
    },
    filename: (req, file, cb) => {
      const extension = getCoverExtension(file.mimetype);
      const userId = req.user?.id || "user";
      const random = crypto.randomBytes(8).toString("hex");

      cb(null, `${userId}-${Date.now()}-${random}${extension}`);
    },
  });
};

const createFileFilter = (getExtension, allowedExtensions, errorMessage) => {
  return (req, file, cb) => {
    const extension = getExtension(file.mimetype);
    const originalExtension = getOriginalExtension(file);

    if (!extension || !allowedExtensions.has(originalExtension)) {
      return cb(new AppError(errorMessage, 400));
    }

    return cb(null, true);
  };
};

const createContentValidator = (isValidHeader, errorMessage) => {
  return async (req, res, next) => {
    if (!req.file) {
      return next();
    }

    try {
      const header = await readFileHeader(req.file.path);

      if (!isValidHeader(header)) {
        await removeUploadedFile(req.file);
        return next(new AppError(errorMessage, 400));
      }

      return next();
    } catch (error) {
      await removeUploadedFile(req.file);
      return next(error);
    }
  };
};

const trackFileFilter = (req, file, cb) => {
  if (isAudioField(file.fieldname)) {
    return createFileFilter(
      getAudioExtension,
      audioExtensions,
      "Invalid audio format. Only MP3 files are allowed"
    )(req, file, cb);
  }

  if (isCoverField(file.fieldname)) {
    return createFileFilter(
      getCoverExtension,
      coverExtensions,
      "Invalid cover format. Only JPG, PNG, and WebP images are allowed"
    )(req, file, cb);
  }

  return cb(new AppError("Invalid file field. Use audio/audio_file and cover/cover_image", 400));
};

const validateTrackContent = async (req, res, next) => {
  const audioFile = getUploadedFile(req, "audio", ["audio_file"]);
  const coverFile = getUploadedFile(req, "cover", ["cover_image"]);
  const files = [audioFile, coverFile].filter(Boolean);

  try {
    if (!audioFile) {
      await removeUploadedFiles(files);
      return next(new AppError("Audio file is required", 400));
    }

    if (coverFile && coverFile.size > COVER_MAX_SIZE) {
      await removeUploadedFiles(files);
      return next(new AppError("Cover file is too large", 413));
    }

    const audioHeader = await readFileHeader(audioFile.path);

    if (!isMp3Header(audioHeader)) {
      await removeUploadedFiles(files);
      return next(
        new AppError("Invalid audio content. Only real MP3 files are allowed", 400)
      );
    }

    if (coverFile) {
      const coverHeader = await readFileHeader(coverFile.path);

      if (!isCoverHeader(coverHeader)) {
        await removeUploadedFiles(files);
        return next(
          new AppError(
            "Invalid cover content. Only real JPG, PNG, and WebP images are allowed",
            400
          )
        );
      }
    }

    return next();
  } catch (error) {
    await removeUploadedFiles(files);
    return next(error);
  }
};

const audioMulter = multer({
  storage: createStorage(audioUploadPath, getAudioExtension),
  limits: {
    fileSize: AUDIO_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(
    getAudioExtension,
    audioExtensions,
    "Invalid audio format. Only MP3 files are allowed"
  ),
});

const coverMulter = multer({
  storage: createStorage(coverUploadPath, getCoverExtension),
  limits: {
    fileSize: COVER_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(
    getCoverExtension,
    coverExtensions,
    "Invalid cover format. Only JPG, PNG, and WebP images are allowed"
  ),
});

const avatarMulter = multer({
  storage: createAvatarStorage(),
  limits: {
    fileSize: AVATAR_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter(
    getCoverExtension,
    avatarExtensions,
    "Invalid avatar format. Only JPG, PNG, and WebP images are allowed"
  ),
});

const trackMulter = multer({
  storage: createTrackStorage(),
  limits: {
    fileSize: AUDIO_MAX_SIZE,
    files: 2,
  },
  fileFilter: trackFileFilter,
});

const uploadAudio = [
  audioMulter.single("file"),
  createContentValidator(
    isMp3Header,
    "Invalid audio content. Only real MP3 files are allowed"
  ),
];

const uploadCover = [
  coverMulter.single("file"),
  createContentValidator(
    isCoverHeader,
    "Invalid cover content. Only real JPG, PNG, and WebP images are allowed"
  ),
];

const uploadAvatar = [
  avatarMulter.single("avatar"),
  createContentValidator(
    isCoverHeader,
    "Invalid avatar content. Only real JPG, PNG, and WebP images are allowed"
  ),
];

const uploadTrack = [
  trackMulter.fields([
    { name: "audio", maxCount: 1 },
    { name: "audio_file", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  validateTrackContent,
];

module.exports = {
  uploadAudio,
  uploadCover,
  uploadAvatar,
  uploadTrack,
  getUploadedFile,
  removeUploadedFiles,
  removeUploadedFile,
};
