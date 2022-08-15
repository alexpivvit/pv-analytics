**Usage example**
```
import PvAnalytics from "pv-analytics";

const pvAnalytics = new PvAnalytics(options);

pvAnalytics.init();
pvAnalytics.event("test", {
    "profile_id": 12345
});
```