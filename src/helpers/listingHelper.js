export const getListingData = async ({
  page = 1,
  limit = 10,
  search = "",
  filters = {},
  getData,
  getCount,
}) => {
  const offset = (page - 1) * limit;

  const data = await getData({
    search,
    filters,
    limit,
    offset,
  });

  const totalRecords = await getCount(search, filters);

  const totalPages = Math.ceil(totalRecords / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages,
      startRecord: totalRecords > 0 ? offset + 1 : 0,
      endRecord: Math.min(offset + data.length, totalRecords),
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
};
