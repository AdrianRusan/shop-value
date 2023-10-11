const FormatPrices = ({num} : { num: number }) => {
  const [wholePart, decimalPart] = Number(num).toFixed(2).split('.');
  const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return (
    <>
      {formattedWholePart}
      <sup>{decimalPart}</sup>
    </>
  );
};

export default FormatPrices