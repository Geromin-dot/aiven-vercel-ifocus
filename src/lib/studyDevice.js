export const STUDY_DEVICES = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'pc', label: 'PC/Desktop' },
  { value: 'both', label: 'Both' },
];
export const isStudyDevice = value => STUDY_DEVICES.some(option => option.value === value);
export const studyDeviceLabel = value => STUDY_DEVICES.find(option => option.value === value)?.label || 'Not selected';
