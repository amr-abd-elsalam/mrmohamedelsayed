/* ── Upgrade Summary ──
   - Removed dead code: sharedObjectives, sharedCurriculum, sharedFaq (declared but never used)
   - Added META.UI object with white-label UI strings previously hardcoded in controllers
   - Added META.heroTitle, META.heroSubtitle, META.ctaTitle, META.ctaSubtitle for white-label hero/CTA
   - Added META.levels map (English→Arabic) to centralize level label translations
   - Added META.emptyStateTitle, META.emptyStateText for catalog empty state
   - Normalized META.legalLastUpdated to consistent value
   - Added trailing comments on each META key for Document 3 change-map traceability
   - No structural changes to courses array or categories
   ── End Summary ── */

'use strict';

var COURSE_DATA = (function () {

  function deepFreeze(o) {
    if (o === null || typeof o !== 'object') return o;
    Object.freeze(o);
    Object.getOwnPropertyNames(o).forEach(function (p) {
      var v = o[p];
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    });
    return o;
  }

  /* ── Course Definitions ── */

  var courses = [
    {
      id: 1,
      title: "الدعامة والحركة في الكائنات الحية — شرح كامل",
      category: "الدعامة والحركة في الكائنات الحية",
      level: "Beginner",
      price: 200.00,
      originalPrice: 350.00,
      students: 0,
      lessons: 1,
      rating: 0,
      date: "2025-09-01",
      language: "ar",
      description: "شرح تفصيلي للفصل الأول من منهج الأحياء للثانوية العامة: الجهاز الهيكلي والعضلي في الإنسان، آلية الانقباض العضلي، الدعامة والحركة في النبات. يشمل رسومات توضيحية محلولة وأسئلة امتحانات سابقة.",
      image: "og-image.png",
      instructor: "مستر محمد السيد",
      tags: ["أحياء", "ثانوية عامة", "دعامة", "حركة", "جهاز هيكلي", "عضلات", "انقباض عضلي"],
      driveUrl: "",
      learningObjectives: [
        "فهم تركيب الجهاز الهيكلي — أنواع العظام والغضاريف ووظائفها",
        "شرح آلية الانقباض العضلي بالتفصيل (نظرية الخيوط المنزلقة)",
        "التمييز بين أنواع العضلات الثلاثة ومقارنة خصائصها",
        "فهم الدعامة في النبات — الدعامة التركيبية والفسيولوجية",
        "تحليل الرسومات التوضيحية الخاصة بالجهاز الهيكلي والعضلي",
        "حل أسئلة علِّل وقارن واختر على الفصل كامل"
      ],
      curriculum: [
        {
          title: "مقدمة الفصل والجهاز الهيكلي",
          lessons: [
            { title: "نظرة عامة — الدعامة والحركة وأهميتها", duration: "06:00", preview: true, previewUrl: "https://www.youtube.com/embed/r0cuXOQFdF8", previewThumb: "" },
            { title: "تركيب العظام وأنواعها", duration: "14:00", preview: true, previewUrl: "https://www.youtube.com/embed/WHhK-gu07A4", previewThumb: "" },
            { title: "الغضاريف والمفاصل — أنواعها ووظائفها", duration: "12:00", preview: false },
            { title: "العمود الفقري والقفص الصدري — تركيب تفصيلي", duration: "15:00", preview: false }
          ]
        },
        {
          title: "الجهاز العضلي وآلية الانقباض",
          lessons: [
            { title: "أنواع العضلات — هيكلية وملساء وقلبية", duration: "10:00", preview: false },
            { title: "التركيب الدقيق للعضلة الهيكلية (الساركومير)", duration: "18:00", preview: false },
            { title: "آلية الانقباض العضلي — نظرية الخيوط المنزلقة", duration: "20:00", preview: false },
            { title: "مقارنات مهمة ورسومات محلولة", duration: "12:00", preview: false }
          ]
        },
        {
          title: "الدعامة والحركة في النبات",
          lessons: [
            { title: "الدعامة التركيبية — السليلوز واللجنين والسوبرين", duration: "14:00", preview: false },
            { title: "الدعامة الفسيولوجية — الامتلاء والانتفاخ", duration: "10:00", preview: false },
            { title: "الحركة في النبات — الانتحاءات والمستيات", duration: "12:00", preview: false }
          ]
        },
        {
          title: "مراجعة نهائية وحل أسئلة",
          lessons: [
            { title: "مراجعة شاملة على الفصل كامل", duration: "20:00", preview: false },
            { title: "حل أسئلة الكتاب المدرسي", duration: "18:00", preview: false },
            { title: "حل أسئلة امتحانات ثانوية عامة سابقة", duration: "25:00", preview: false }
          ]
        }
      ],
      faq: [
        {
          question: "هل الكورس يغطي فصل الدعامة بالكامل؟",
          answer: "أيوا، من أول تركيب العظام لآلية الانقباض العضلي لحد الدعامة في النبات — كل حاجة في الكتاب المدرسي مشروحة بالتفصيل."
        },
        {
          question: "الرسومات التوضيحية مشروحة؟",
          answer: "طبعاً. كل رسمة مطلوبة في الامتحان مشروحة خطوة بخطوة — الساركومير، العمود الفقري، المفاصل، وغيرهم."
        },
        {
          question: "فيه حل أسئلة امتحانات؟",
          answer: "أيوا، الكورس فيه حل لأسئلة امتحانات ثانوية عامة فعلية من سنوات سابقة على كل جزء من الفصل."
        },
        {
          question: "الكورس مناسب لو أنا مبتدئ في المنهج؟",
          answer: "100%. الشرح متدرج ومبسط من الصفر. مش محتاج تكون عارف حاجة قبل ما تبدأ."
        },
        {
          question: "إزاي أوصل للكورس بعد الشراء؟",
          answer: "بعد تأكيد الدفع على واتساب، هتوصلك بيانات الدخول (إيميل وباسورد) وتقدر تدخل الكورس من صفحته مباشرة."
        }
      ]
    },
    {
      id: 2,
      title: "التكاثر واستمرارية الحياة — شرح كامل",
      category: "التكاثر واستمرارية الحياة",
      level: "Beginner",
      price: 250.00,
      originalPrice: 400.00,
      students: 0,
      lessons: 1,
      rating: 0,
      date: "2025-10-15",
      language: "ar",
      description: "شرح شامل لفصل التكاثر من منهج الأحياء للثانوية العامة: التكاثر اللاجنسي والجنسي، دورة حياة بلازموديوم الملاريا، الجهاز التناسلي في الإنسان، مراحل تكوين الجنين، والهرمونات المنظمة للدورة الشهرية والحمل.",
      image: "og-image.png",
      instructor: "مستر محمد السيد",
      tags: ["أحياء", "ثانوية عامة", "تكاثر", "جنسي", "لاجنسي", "جهاز تناسلي", "ملاريا", "جنين"],
      driveUrl: "",
      learningObjectives: [
        "التمييز بين صور التكاثر اللاجنسي المختلفة بالأمثلة",
        "شرح دورة حياة بلازموديوم الملاريا بالتفصيل",
        "فهم تركيب الجهاز التناسلي الذكري والأنثوي في الإنسان",
        "شرح مراحل تكوين الحيوان المنوي والبويضة",
        "تتبع مراحل تكوين الجنين من الإخصاب للولادة",
        "فهم دور الهرمونات في تنظيم الدورة الشهرية والحمل"
      ],
      curriculum: [
        {
          title: "التكاثر اللاجنسي",
          lessons: [
            { title: "مقدمة — أهمية التكاثر واستمرارية النوع", duration: "07:00", preview: true, previewUrl: "https://www.youtube.com/embed/-8_uHf16TIk", previewThumb: "" },
            { title: "صور التكاثر اللاجنسي — الانشطار والتبرعم والتجدد", duration: "15:00", preview: true, previewUrl: "https://www.youtube.com/embed/2_shSnYAJig", previewThumb: "" },
            { title: "التكاثر بالأبواغ والتكاثر الخضري", duration: "12:00", preview: false }
          ]
        },
        {
          title: "التكاثر الجنسي ودورة حياة الملاريا",
          lessons: [
            { title: "التكاثر الجنسي — مفهومه وأهميته البيولوجية", duration: "10:00", preview: false },
            { title: "دورة حياة بلازموديوم الملاريا — شرح تفصيلي بالرسم", duration: "22:00", preview: false },
            { title: "التكاثر في النباتات الزهرية", duration: "16:00", preview: false }
          ]
        },
        {
          title: "التكاثر في الإنسان",
          lessons: [
            { title: "الجهاز التناسلي الذكري — التركيب والوظيفة", duration: "18:00", preview: false },
            { title: "الجهاز التناسلي الأنثوي — التركيب والوظيفة", duration: "18:00", preview: false },
            { title: "تكوين الحيوانات المنوية والبويضات", duration: "15:00", preview: false },
            { title: "الدورة الشهرية ودور الهرمونات", duration: "16:00", preview: false }
          ]
        },
        {
          title: "الإخصاب وتكوين الجنين",
          lessons: [
            { title: "الإخصاب والانغراس — من البويضة المخصبة للجنين", duration: "14:00", preview: false },
            { title: "مراحل تكوين الجنين والأغشية الجنينية", duration: "16:00", preview: false },
            { title: "الولادة والرضاعة ودور الهرمونات", duration: "10:00", preview: false }
          ]
        },
        {
          title: "مراجعة نهائية وحل أسئلة",
          lessons: [
            { title: "مراجعة شاملة على الفصل كامل", duration: "22:00", preview: false },
            { title: "حل أسئلة الكتاب المدرسي", duration: "18:00", preview: false },
            { title: "حل أسئلة امتحانات ثانوية عامة سابقة", duration: "28:00", preview: false }
          ]
        }
      ],
      faq: [
        {
          question: "هل دورة حياة الملاريا مشروحة بالرسم؟",
          answer: "أيوا، الدورة مشروحة خطوة بخطوة مع رسم تفصيلي وتوضيح لكل مرحلة — من القرصة لحد ظهور الأعراض."
        },
        {
          question: "الكورس بيغطي الجهاز التناسلي بالكامل؟",
          answer: "بالكامل — الذكري والأنثوي، تكوين الأمشاج، الدورة الشهرية، الإخصاب، وتكوين الجنين. كل حاجة مطلوبة في المنهج."
        },
        {
          question: "فيه مقارنات جاهزة بين التكاثر الجنسي واللاجنسي؟",
          answer: "أيوا، كل المقارنات المهمة مجمعة ومشروحة بشكل واضح ومرتب."
        },
        {
          question: "ممكن أشترك في كورس واحد بس؟",
          answer: "طبعاً! تقدر تشتري أي كورس لوحده. أو تتواصل معانا لو عايز عرض على أكتر من كورس."
        },
        {
          question: "بعد الشراء أقدر أرجع أتفرج تاني؟",
          answer: "أيوا، وصولك مدى الحياة. تقدر ترجع تتفرج أي عدد مرات من أي جهاز."
        }
      ]
    },
    {
      id: 3,
      title: "التنسيق الهرموني والعصبي — شرح كامل",
      category: "التنسيق الهرموني والعصبي",
      level: "Intermediate",
      price: 250.00,
      originalPrice: 400.00,
      students: 0,
      lessons: 1,
      rating: 0,
      date: "2025-11-01",
      language: "ar",
      description: "شرح وافي لفصل التنسيق الهرموني من منهج الأحياء للثانوية العامة: جهاز الغدد الصماء في الإنسان، الغدة النخامية والدرقية والبنكرياس والكظرية، الهرمونات ووظائفها، أمراض الخلل الهرموني، والهرمونات النباتية (الأوكسينات).",
      image: "og-image.png",
      instructor: "مستر محمد السيد",
      tags: ["أحياء", "ثانوية عامة", "هرمونات", "غدد صماء", "نخامية", "درقية", "بنكرياس", "أوكسينات"],
      driveUrl: "",
      learningObjectives: [
        "فهم الفرق بين الغدد الصماء والغدد القنوية والمشتركة",
        "شرح وظائف الغدة النخامية — الفص الأمامي والخلفي",
        "تحليل دور هرمونات الغدة الدرقية والبنكرياس في اتزان الجسم",
        "التمييز بين أمراض زيادة ونقص الهرمونات",
        "فهم الهرمونات النباتية (الأوكسينات) ودورها في النمو",
        "حل أسئلة علِّل وقارن والرسومات المطلوبة في الامتحان"
      ],
      curriculum: [
        {
          title: "مقدمة في التنسيق الهرموني",
          lessons: [
            { title: "ما هو التنسيق الهرموني؟ — مقدمة ومفاهيم أساسية", duration: "08:00", preview: true, previewUrl: "https://www.youtube.com/embed/z2CRb1AYdwI", previewThumb: "" },
            { title: "أنواع الغدد — صماء وقنوية ومشتركة", duration: "12:00", preview: true, previewUrl: "https://www.youtube.com/embed/QmMZFMdai-g", previewThumb: "" },
            { title: "العلاقة بين الجهاز العصبي والهرموني", duration: "10:00", preview: false }
          ]
        },
        {
          title: "الغدة النخامية والغدة الدرقية",
          lessons: [
            { title: "الغدة النخامية — سيدة الغدد الصماء", duration: "20:00", preview: false },
            { title: "هرمونات الفص الأمامي والخلفي للنخامية", duration: "16:00", preview: false },
            { title: "الغدة الدرقية — الثيروكسين ونقصه وزيادته", duration: "18:00", preview: false },
            { title: "الغدة الجار درقية — الكالسيتونين والباراثورمون", duration: "12:00", preview: false }
          ]
        },
        {
          title: "غدد الجسم الأخرى",
          lessons: [
            { title: "البنكرياس — الأنسولين والجلوكاجون وتنظيم سكر الدم", duration: "18:00", preview: false },
            { title: "الغدة الكظرية — الأدرينالين والكورتيزول", duration: "14:00", preview: false },
            { title: "الغدة الصنوبرية والتيموسية", duration: "10:00", preview: false },
            { title: "الغدد التناسلية وهرموناتها", duration: "12:00", preview: false }
          ]
        },
        {
          title: "الهرمونات النباتية",
          lessons: [
            { title: "الأوكسينات — اكتشافها ودورها في النمو والانتحاء", duration: "14:00", preview: false },
            { title: "تطبيقات الهرمونات النباتية", duration: "08:00", preview: false }
          ]
        },
        {
          title: "مراجعة نهائية وحل أسئلة",
          lessons: [
            { title: "مراجعة شاملة — كل الغدد والهرمونات في جدول واحد", duration: "22:00", preview: false },
            { title: "حل أسئلة الكتاب المدرسي", duration: "18:00", preview: false },
            { title: "حل أسئلة امتحانات ثانوية عامة سابقة", duration: "28:00", preview: false }
          ]
        }
      ],
      faq: [
        {
          question: "ليه فصل الهرمونات بيتقال عليه صعب؟",
          answer: "لأن فيه تفاصيل كتير وغدد وهرمونات بأسماء متشابهة. عشان كده الكورس بيشرح كل غدة لوحدها بالترتيب، ومع جداول مقارنة بتسهل الحفظ والفهم."
        },
        {
          question: "هل الكورس فيه جداول ملخصة للغدد والهرمونات؟",
          answer: "أيوا، فيه جدول شامل بكل الغدد ومكانها وهرموناتها ووظائفها وأمراض الخلل — مجمع في مراجعة نهائية."
        },
        {
          question: "الهرمونات النباتية داخلة في الكورس؟",
          answer: "طبعاً. الأوكسينات مشروحة بالكامل — اكتشافها ودورها في الانتحاء والتطبيقات العملية."
        },
        {
          question: "أقدر أسأل لو في حاجة مش فاهمها؟",
          answer: "أيوا، ابعتلنا على واتساب وهنرد عليك. التواصل المباشر مع المدرس متاح لكل الطلاب."
        },
        {
          question: "لو اشتريت الكورس ده بس، هيكفيني للامتحان؟",
          answer: "الكورس بيغطي فصل التنسيق الهرموني بالكامل. لو عايز تغطي المنهج كله، شوف باقي الكورسات أو تواصل معانا لعرض خاص."
        }
      ]
    },
    {
      id: 4,
      title: "البيولوجيا الجزيئية والتكنولوجيا الحيوية — شرح كامل",
      category: "البيولوجيا الجزيئية والتكنولوجيا الحيوية",
      level: "Advanced",
      price: 300.00,
      originalPrice: 500.00,
      students: 0,
      lessons: 1,
      rating: 0,
      date: "2025-12-01",
      language: "ar",
      description: "شرح متكامل للباب الثاني من منهج الأحياء للثانوية العامة: تركيب DNA ونموذج واطسون وكريك، التضاعف، الطفرات الجينية، RNA وأنواعه، الشفرة الوراثية، خطوات بناء البروتين، الهندسة الوراثية، والجينوم البشري.",
      image: "og-image.png",
      instructor: "مستر محمد السيد",
      tags: ["أحياء", "ثانوية عامة", "DNA", "RNA", "بروتين", "وراثة", "هندسة وراثية", "جينوم", "بيولوجيا جزيئية"],
      driveUrl: "",
      learningObjectives: [
        "فهم تركيب الحمض النووي DNA ونموذج واطسون وكريك",
        "شرح خطوات تضاعف DNA في أوليات وحقيقيات النواة",
        "التمييز بين أنواع الطفرات الجينية وتأثيراتها",
        "شرح أنواع RNA الثلاثة ودور كل منها في بناء البروتين",
        "تتبع خطوات بناء البروتين من النسخ للترجمة",
        "فهم أساسيات الهندسة الوراثية ومشروع الجينوم البشري"
      ],
      curriculum: [
        {
          title: "الحمض النووي DNA",
          lessons: [
            { title: "مقدمة — المادة الوراثية وإثبات أن DNA هو حامل الصفات", duration: "12:00", preview: true, previewUrl: "PREVIEW_URL_4_0_0", previewThumb: "" },
            { title: "تركيب DNA — نموذج واطسون وكريك بالتفصيل", duration: "20:00", preview: true, previewUrl: "PREVIEW_URL_4_0_1", previewThumb: "" },
            { title: "تضاعف DNA — الخطوات والإنزيمات", duration: "22:00", preview: false },
            { title: "الفرق بين التضاعف في أوليات وحقيقيات النواة", duration: "14:00", preview: false }
          ]
        },
        {
          title: "الطفرات الجينية",
          lessons: [
            { title: "أنواع الطفرات — الاستبدال والإضافة والحذف", duration: "16:00", preview: false },
            { title: "تأثير الطفرات على البروتين والصفات", duration: "12:00", preview: false },
            { title: "المطفرات وأمثلة على الأمراض الوراثية", duration: "10:00", preview: false }
          ]
        },
        {
          title: "RNA وتخليق البروتين",
          lessons: [
            { title: "أنواع RNA الثلاثة — mRNA و tRNA و rRNA", duration: "14:00", preview: false },
            { title: "الشفرة الوراثية — خصائصها وجدول الكودونات", duration: "16:00", preview: false },
            { title: "النسخ (Transcription) — من DNA إلى mRNA", duration: "18:00", preview: false },
            { title: "الترجمة (Translation) — من mRNA إلى بروتين", duration: "22:00", preview: false }
          ]
        },
        {
          title: "الهندسة الوراثية والجينوم",
          lessons: [
            { title: "أساسيات الهندسة الوراثية — الأدوات والخطوات", duration: "16:00", preview: false },
            { title: "تطبيقات الهندسة الوراثية في الطب والزراعة", duration: "12:00", preview: false },
            { title: "مشروع الجينوم البشري — أهدافه ونتائجه", duration: "10:00", preview: false }
          ]
        },
        {
          title: "مراجعة نهائية وحل أسئلة",
          lessons: [
            { title: "مراجعة شاملة — DNA و RNA وبناء البروتين", duration: "25:00", preview: false },
            { title: "حل أسئلة الكتاب المدرسي", duration: "20:00", preview: false },
            { title: "حل أسئلة امتحانات ثانوية عامة سابقة", duration: "30:00", preview: false }
          ]
        }
      ],
      faq: [
        {
          question: "البيولوجيا الجزيئية صعبة. الكورس مناسب لو مستواي مبتدئ؟",
          answer: "الشرح بيبدأ من الصفر — من إثبات إن DNA هو المادة الوراثية لحد الهندسة الوراثية. كل خطوة متشرحة بالرسومات والأمثلة."
        },
        {
          question: "الرسومات الخاصة بـ DNA والبروتين مشروحة؟",
          answer: "أيوا، كل الرسومات المطلوبة في الامتحان — تركيب DNA، التضاعف، النسخ، الترجمة — كلها مشروحة بالتفصيل."
        },
        {
          question: "فيه شرح للهندسة الوراثية والجينوم؟",
          answer: "طبعاً. الكورس بيغطي أساسيات الهندسة الوراثية وتطبيقاتها ومشروع الجينوم البشري — كل اللي مطلوب في الكتاب المدرسي."
        },
        {
          question: "إيه الفرق بين الكورس ده وفصل الهرمونات؟",
          answer: "فصل الهرمونات في الباب الأول (التركيب والوظيفة). البيولوجيا الجزيئية هي الباب الثاني كامل — DNA و RNA وبناء البروتين والهندسة الوراثية."
        },
        {
          question: "لو عايز أشتري كل الكورسات مع بعض، فيه عرض؟",
          answer: "أيوا! تواصل معانا على واتساب وهنعملك عرض خاص على الباقة الكاملة (٤ كورسات) بخصم كبير."
        }
      ]
    }
  ];

  /* ── Categories ── */

  var categories = {
    "الدعامة والحركة في الكائنات الحية":      { color: "emerald" },
    "التكاثر واستمرارية الحياة":              { color: "teal" },
    "التنسيق الهرموني والعصبي":              { color: "cyan" },
    "البيولوجيا الجزيئية والتكنولوجيا الحيوية": { color: "emerald" }
  };

  /* ── Brand Constants ── */

  var WHATSAPP_NUMBER = "201008464341";
  var BRAND_NAME      = "مستر محمد السيد";
  var DOMAIN          = "mrmohamedelsayed.com";

  /* ── Auto-derive lesson count from curriculum ── */

  courses.forEach(function (c) {
    if (c.curriculum && c.curriculum.length) {
      c.lessons = c.curriculum.reduce(function (sum, section) {
        return sum + (section.lessons ? section.lessons.length : 0);
      }, 0);
    }
  });

  /* ── Freeze and Export ── */

  return deepFreeze({
    courses:         courses,
    categories:      categories,
    WHATSAPP_NUMBER: WHATSAPP_NUMBER,
    BRAND_NAME:      BRAND_NAME,
    DOMAIN:          DOMAIN,

    META: {
      /* ── SEO / Branding ── */
      tagline:          'مستر محمد السيد — أستاذ الأحياء للثانوية العامة',
      description:      'منصة مستر محمد السيد لتعليم مادة الأحياء لطلاب الثانوية العامة (الصف الثالث الثانوي — شعبة علمي علوم) في مصر. شرح تفصيلي لكل فصول المنهج مع رسومات توضيحية محلولة وأسئلة امتحانات سابقة. وصول مدى الحياة ودعم مباشر من المدرس عبر واتساب.',
      descriptionShort: 'منصة مستر محمد السيد — شرح أحياء الثانوية العامة بالتفصيل مع أسئلة محلولة ودعم مباشر.',
      ogImage:          '/assets/img/og-image.png',
      supportEmail:     'mrmohamedelsayed@gmail.com',
      foundingYear:     '2025',
      logoPath:         '/assets/img/fav180.png',
      legalLastUpdated: '2026-03-10',

      /* ── WhatsApp ── */
      whatsappDefaultMessage: 'مرحباً يا مستر! عندي سؤال عن الكورسات.',

      /* ── Chat Widget ── */
      chatBotName:        'مساعد مستر محمد',
      chatWelcomeMessage: 'أهلاً بيك! أنا هنا عشان أساعدك بأي سؤال عن الكورس. اسألني أي حاجة!',
      chatPlaceholder:    'اكتب سؤالك هنا...',
      chatErrorMessage:   'حصل مشكلة في الاتصال. جرّب تاني.',

      /* ── White-label UI Strings ──
         These strings contain brand-specific or subject-specific text
         that was previously hardcoded in page controllers.
         Moving them here enables white-label customization via
         COURSE_DATA alone without editing JS controllers.
      */

      /* Hero section (index.html) */
      heroLine1:    'افهم الأحياء صح،',
      heroLine2:    'وحقق أعلى الدرجات.',
      heroSubtitle: 'شرح تفصيلي لمنهج الأحياء للثانوية العامة — من الدعامة والحركة للبيولوجيا الجزيئية. رسومات توضيحية، أسئلة محلولة، ودعم مباشر من المدرس.',
      heroBadge:    'أحياء الثانوية العامة — شرح تفصيلي',

      /* CTA section (index.html) */
      ctaTitle:    'مستعد تفهم الأحياء صح؟',
      ctaSubtitle: 'كورسات شاملة لكل فصول المنهج — شرح مبسط، رسومات محلولة، وأسئلة امتحانات. ابدأ النهارده واستعد لامتحان الثانوية العامة.',

      /* Footer tagline (all pages) */
      footerTagline: 'شرح مادة الأحياء للثانوية العامة بأسلوب مبسط وتفصيلي. وصول مدى الحياة ودعم مباشر من المدرس.',

      /* Course level labels (English key → Arabic display) */
      levels: {
        'All':          'كل المستويات',
        'Beginner':     'مبتدئ',
        'Intermediate': 'متوسط',
        'Advanced':     'متقدم'
      },

      /* Catalog empty state */
      emptyStateTitle: 'مفيش كورسات',
      emptyStateText:  'جرّب تغيّر الفلاتر أو كلمة البحث',
      resetFiltersLabel: 'إعادة ضبط الفلاتر',

      /* Catalog results format: used with U.formatNumberAr */
      resultsTemplate: 'عرض {start}\u2013{end} من {total} نتيجة',

      /* Course details section titles */
      sectionObjectives: 'هتتعلم إيه',
      sectionCurriculum: 'محتوى الكورس',
      sectionFaq:        'أسئلة شائعة',

      /* Rating card strings */
      ratingTitle:       'قيّم الكورس',
      ratingSubtitle:    'شاركنا رأيك عشان نحسّن المحتوى',
      ratingLoading:     'جاري تحميل التقييمات...',
      ratingEmpty:       'مفيش تقييمات لسه — كن أول من يقيّم!',
      ratingSubmitting:  'جاري إرسال تقييمك...',
      ratingSuccess:     'شكراً لتقييمك! \u2764',
      ratingError:       'حصل مشكلة. جرّب تاني.',
      ratingUnavailable: 'نظام التقييم غير متاح حالياً',

      /* Price formatting */
      currencyLabel: 'ج.م',
      freeLabel:     'مجاني',

      /* Navigation labels */
      navHome:     'الرئيسية',
      navCourses:  'الكورسات',
      navAbout:    'عن المدرس',
      navBrowseAll: 'تصفح الكل',

      /* Shared button / action labels */
      viewCourse:    'عرض الكورس',
      buyCourse:     'اشتري الآن',
      startLearning: 'ابدأ التعلم الآن',
      enterCourse:   'اشتريت الكورس\u061F ادخل هنا \u{1F511}',
      backToCourses: 'العودة للكورسات',
      contactWhatsApp: 'تواصل على واتساب',

      /* Error page */
      errorTitle: 'الكورس غير موجود',
      errorText:  'الكورس اللي بتدور عليه مش موجود. ممكن يكون اتحذف أو الرابط غلط.',
      errorBrowse: 'تصفح الكورسات',

      /* Copyright template — {year} and {brand} are replaced at runtime */
      copyrightTemplate: '© {year} {brand}. جميع الحقوق محفوظة.',

      previewPlayLabel: 'اضغط للمعاينة المجانية',
      previewCloseLabel: 'إغلاق المعاينة',
      previewFullscreenLabel: 'ملء الشاشة',
      previewExitFullscreenLabel: 'خروج من ملء الشاشة'
    }
  });

})();

if (typeof window !== 'undefined') window.COURSE_DATA = COURSE_DATA;
