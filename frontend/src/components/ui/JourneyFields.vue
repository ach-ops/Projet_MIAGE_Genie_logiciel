<script setup lang="ts">
withDefaults(
  defineProps<{
    departure?: string
    arrival?: string
    departurePlaceholder?: string
    arrivalPlaceholder?: string
  }>(),
  {
    departure: '',
    arrival: '',
    departurePlaceholder: "D'ou partez-vous ?",
    arrivalPlaceholder: 'Ou allez-vous ?',
  }
)

const emit = defineEmits<{
  swap: []
  'locate-departure': []
  'locate-arrival': []
}>()
</script>

<template>
  <div class="relative flex w-full flex-col gap-[18px] py-[6px]">
    <div
      class="flex min-h-[94px] items-center justify-between rounded-[18px] border-[3px] border-[#bcc6c8] bg-[#f8f9f9] px-[18px] max-[900px]:min-h-[78px] max-[900px]:px-[14px] max-[640px]:min-h-[70px] max-[640px]:rounded-[14px] max-[640px]:border-[2px]"
    >
      <div class="flex min-w-0 items-center gap-[14px]">
        <svg
          class="h-[36px] w-[36px] shrink-0 text-[#0f1516] max-[640px]:h-[30px] max-[640px]:w-[30px]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 3a3 3 0 1 1 0 6a3 3 0 0 1 0-6Zm0 6v7m-7 3a7 7 0 0 1 14 0M4 19h16"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>

        <p class="m-0 flex items-baseline gap-2 text-[40px] leading-none">
          <span
            class="text-[20px] font-extrabold text-[#0d1112] max-[900px]:text-[18px] max-[640px]:text-[16px]"
          >
            Depart :
          </span>
          <span
            :class="
              departure
                ? 'text-[40px] font-bold text-[#101516] max-[900px]:text-[30px] max-[640px]:text-[24px]'
                : 'text-[40px] font-bold text-[#808687] max-[900px]:text-[30px] max-[640px]:text-[24px]'
            "
          >
            {{ departure || departurePlaceholder }}
          </span>
        </p>
      </div>

      <button
        type="button"
        class="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#0d1112] hover:bg-[#eef2f2]"
        aria-label="Utiliser ma position pour le depart"
        @click="emit('locate-departure')"
      >
        <svg
          class="h-10 w-10 max-[640px]:h-[34px] max-[640px]:w-[34px]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.66-6.66-2.12 2.12M8.46 15.54l-2.12 2.12m11.32 0-2.12-2.12M8.46 8.46l-2.12-2.12"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.8"
          />
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
    </div>

    <button
      type="button"
      class="absolute right-[88px] top-1/2 inline-flex h-16 w-16 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[18px] border-[5px] border-[#1d9db6] bg-[#eef9fb] text-[#1d9db6] max-[900px]:right-16 max-[900px]:h-14 max-[900px]:w-14 max-[640px]:right-[54px] max-[640px]:h-[50px] max-[640px]:w-[50px] max-[640px]:rounded-[14px] max-[640px]:border-[4px]"
      aria-label="Inverser depart et arrivee"
      @click="emit('swap')"
    >
      <svg class="h-8 w-8" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 4v14m0 0-3-3m3 3 3-3M16 20V6m0 0-3 3m3-3 3 3"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
    </button>

    <div
      class="flex min-h-[94px] items-center justify-between rounded-[18px] border-[3px] border-[#bcc6c8] bg-[#f8f9f9] px-[18px] max-[900px]:min-h-[78px] max-[900px]:px-[14px] max-[640px]:min-h-[70px] max-[640px]:rounded-[14px] max-[640px]:border-[2px]"
    >
      <div class="flex min-w-0 items-center gap-[14px]">
        <svg
          class="h-[36px] w-[36px] shrink-0 text-[#0f1516] max-[640px]:h-[30px] max-[640px]:w-[30px]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M5 4v16m0-12c3-2 5 2 8 0s5 2 6 0v8c-1 2-3-1-6 1s-5-2-8 0"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>

        <p class="m-0 flex items-baseline gap-2 text-[40px] leading-none">
          <span
            class="text-[20px] font-extrabold text-[#0d1112] max-[900px]:text-[18px] max-[640px]:text-[16px]"
          >
            Arrivee :
          </span>
          <span
            :class="
              arrival
                ? 'text-[40px] font-bold text-[#101516] max-[900px]:text-[30px] max-[640px]:text-[24px]'
                : 'text-[40px] font-bold text-[#808687] max-[900px]:text-[30px] max-[640px]:text-[24px]'
            "
          >
            {{ arrival || arrivalPlaceholder }}
          </span>
        </p>
      </div>

      <button
        type="button"
        class="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[#0d1112] hover:bg-[#eef2f2]"
        aria-label="Utiliser ma position pour l'arrivee"
        @click="emit('locate-arrival')"
      >
        <svg
          class="h-10 w-10 max-[640px]:h-[34px] max-[640px]:w-[34px]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.66-6.66-2.12 2.12M8.46 15.54l-2.12 2.12m11.32 0-2.12-2.12M8.46 8.46l-2.12-2.12"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.8"
          />
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</template>
