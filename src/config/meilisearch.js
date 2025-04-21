import config from "./index.js";

export const searchableAttributes = [
    "title",
    "description",
    "subject",
    "examBoard",
    "level",
    "type",
];

export const filterableAttributes = [
    "subject",
    "examBoard",
    "level",
    "type",
    "author",
    "tags",
    "averageRating",
];

export const sortableAttributes = ["averageRating", "title"];

export const synonyms = {
    math: ["mathematics", "maths"],
    bio: ["biology"],
    chem: ["chemistry"],
    phys: ["physics"],
    eng: ["english"],
    lit: ["literature"],
    geo: ["geography"],
    hist: ["history"],
};

export const typoTolerance = {
    enabled: true,
    minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 6,
    },
};
