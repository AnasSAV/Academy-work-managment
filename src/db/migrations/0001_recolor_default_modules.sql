-- Module colours that were assigned automatically (the seed and the first eight defaults) failed
-- the colour-vision checks: blue and violet were nearly identical to a deuteranope. Move exactly
-- those default values to the validated palette. A module whose colour was chosen by hand is left
-- alone, because it will not match any of these values.
UPDATE `module` SET `color` = CASE `color`
  WHEN '#3b82f6' THEN '#2a78d6'
  WHEN '#8b5cf6' THEN '#eb6834'
  WHEN '#f59e0b' THEN '#1baf7a'
  WHEN '#10b981' THEN '#eda100'
  WHEN '#ec4899' THEN '#e87ba4'
  WHEN '#ef4444' THEN '#008300'
  WHEN '#06b6d4' THEN '#4a3aa7'
  WHEN '#84cc16' THEN '#e34948'
END
WHERE `color` IN ('#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#ef4444', '#06b6d4', '#84cc16');
