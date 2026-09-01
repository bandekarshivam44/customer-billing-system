const STORAGE_KEY = "app_fake_now";
const RealDate = Date;

const FakeDate = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { super(saved); return; }
    }
    super(...args);
  }
  static now() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new RealDate(saved).getTime() : RealDate.now();
  }
};

// eslint-disable-next-line no-global-assign
Date = FakeDate;