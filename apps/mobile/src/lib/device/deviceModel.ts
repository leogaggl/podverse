/**
 * Joins a manufacturer and a model into one device name. A model that already starts with the
 * manufacturer is kept as-is, and an empty pair is null.
 */
export const joinDeviceModel = (manufacturer: string, model: string): string | null => {
  const brand = manufacturer.trim();
  const name = model.trim();
  if (brand === '' && name === '') {
    return null;
  }
  if (name === '') {
    return brand;
  }
  if (brand === '' || name.toLowerCase().startsWith(brand.toLowerCase())) {
    return name;
  }
  return `${brand} ${name}`;
};
