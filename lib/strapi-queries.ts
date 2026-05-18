export const QUERY_DASHBOARD = {
  populate: {
    favicon: {
      fields: ["url", "alternativeText"],
    },
    sections: {
      on: {
        "layout.hero-section": {
          populate: {
            image: {
              fields: ["url", "alternativeText"],
            },
            link: {
              populate: true,
            },
          },
        },
      },
    },
  },
};

export const QUERY_SINGIN = {
  populate: {
    header: {
      populate: {
        favicon: {
          fields: ["url", "alternativeText"],
        },
      },
    },
    sections: {
      on: {
        "layout.singin-form": {
          populate: "*",
        },
      },
    },
  },
};

export const QUERY_SINGUP = {
  populate: {
    header: {
      populate: {
        favicon: {
          fields: ["url", "alternativeText"],
        },
      },
    },
    sections: {
      on: {
        "layout.singup-form": {
          populate: "*",
        },
      },
    },
  },
};