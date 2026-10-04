const { listRegisters, buildWorkbook } = require("../utils/statutoryRegisters");

exports.list = (req, res) => {
  res.json(listRegisters());
};

exports.download = async (req, res, next) => {
  try {
    const id = req.params.id;
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const result = await buildWorkbook(id, companyId, year, month);
    if (result.error) return res.status(404).json({ message: result.error });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    await result.wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
};
