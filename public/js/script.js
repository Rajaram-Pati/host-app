(() => {
    'use strict';

    const forms = document.querySelectorAll('.needs-validation');

    Array.from(forms).forEach((form) => {
        form.addEventListener('submit', (event) => {

            if (!form.checkValidity()) {

                event.preventDefault();
                event.stopPropagation();

            }

            form.classList.add('was-validated');

        }, false);
    });

})();

(() => {
    'use strict';

    const countryInputs = document.querySelectorAll('.country-search-input');
    const countryOptions = document.querySelector('#country-options');

    if (!countryInputs.length || !countryOptions) {
        return;
    }

    let debounceTimer;

    const loadCountryOptions = async (query = '') => {
        try {
            const response = await fetch(`/listings/search/countries?q=${encodeURIComponent(query)}`);

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            countryOptions.replaceChildren(
                ...data.countries.map((country) => {
                    const option = document.createElement('option');
                    option.value = country;
                    return option;
                })
            );
        } catch (err) {
            countryOptions.replaceChildren();
        }
    };

    countryInputs.forEach((input) => {
        input.addEventListener('focus', () => loadCountryOptions(input.value));
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => loadCountryOptions(input.value), 180);
        });
    });

    loadCountryOptions();
})();

(() => {
    'use strict';

    const taxSwitch = document.querySelector('#taxSwitch');
    const taxInfo = document.querySelectorAll('.tax-info');

    if (!taxSwitch || !taxInfo.length) {
        return;
    }

    const updateTaxVisibility = () => {
        taxInfo.forEach((item) => {
            item.style.display = taxSwitch.checked ? 'inline' : 'none';
        });
    };

    taxSwitch.addEventListener('change', updateTaxVisibility);
    updateTaxVisibility();
})();

(() => {
    'use strict';

    if (typeof listingBookingConfig === 'undefined') {
        return;
    }

    const config = listingBookingConfig;
    const form = document.querySelector('#bookingForm');
    const checkInInput = document.querySelector('#checkIn');
    const checkOutInput = document.querySelector('#checkOut');
    const guestsInput = document.querySelector('#totalGuests');
    const nightsDisplay = document.querySelector('#totalNightsDisplay');
    const alertBox = document.querySelector('#bookingAlert');
    const bookNowBtn = document.querySelector('#bookNowBtn');
    const calendar = document.querySelector('#bookingCalendar');
    const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

    const toDateOnly = (date) => date.toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayValue = toDateOnly(today);

    if (checkInInput) {
        checkInInput.min = todayValue;
    }

    if (checkOutInput) {
        checkOutInput.min = todayValue;
    }

    const parseDate = (value) => {
        if (!value) return null;
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const nightsBetween = (start, end) => {
        if (!start || !end) return 0;
        return Math.round((end - start) / (1000 * 60 * 60 * 24));
    };

    const setAvailability = (available, message = '') => {
        if (!alertBox || !bookNowBtn) return;

        alertBox.className = `alert ${available ? 'alert-success' : 'alert-danger'} ${message ? '' : 'd-none'}`;
        alertBox.textContent = message;
        bookNowBtn.disabled = !available;
    };

    const calculateFees = (nights) => {
        const subtotal = config.price * nights;
        const cleaningFee = Math.round(Math.max(499, config.price * 0.08));
        const serviceFee = Math.round(subtotal * 0.12);

        return {
            subtotal,
            cleaningFee,
            serviceFee,
            total: subtotal + cleaningFee + serviceFee,
        };
    };

    const updateTotals = () => {
        const checkIn = parseDate(checkInInput?.value);
        const checkOut = parseDate(checkOutInput?.value);
        const nights = nightsBetween(checkIn, checkOut);
        const validNights = Math.max(nights, 0);
        const fees = calculateFees(validNights);

        if (nightsDisplay) nightsDisplay.value = validNights;
        document.querySelector('#nightlyLine').textContent = money.format(fees.subtotal);
        document.querySelector('#cleaningFeeLine').textContent = validNights ? money.format(fees.cleaningFee) : money.format(0);
        document.querySelector('#serviceFeeLine').textContent = money.format(fees.serviceFee);
        document.querySelector('#grandTotalLine').textContent = validNights ? money.format(fees.total) : money.format(0);

        return { checkIn, checkOut, nights };
    };

    const checkAvailability = async () => {
        if (!form || !checkInInput.value || !checkOutInput.value || !guestsInput.value) {
            setAvailability(false, '');
            return;
        }

        const { checkIn, checkOut, nights } = updateTotals();

        if (!checkIn || !checkOut || checkIn < today) {
            setAvailability(false, 'Check-in date cannot be in the past.');
            return;
        }

        if (nights < 1) {
            setAvailability(false, 'Check-out must be after check-in.');
            return;
        }

        if (nights < config.minStay) {
            setAvailability(false, `Minimum stay is ${config.minStay} night${config.minStay === 1 ? '' : 's'}.`);
            return;
        }

        if (nights > config.maxStay) {
            setAvailability(false, `Maximum stay is ${config.maxStay} nights.`);
            return;
        }

        try {
            const query = new URLSearchParams({
                checkIn: checkInInput.value,
                checkOut: checkOutInput.value,
                totalGuests: guestsInput.value,
            });
            const response = await fetch(`/listings/${config.listingId}/bookings/availability?${query.toString()}`, {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Availability check failed with ${response.status}`);
            }

            const data = await response.json();
            const hasNextDate = data.nextAvailableLabel && !(data.message || '').includes('Available again');
            const nextDate = hasNextDate ? ` Available again from ${data.nextAvailableLabel}.` : '';

            setAvailability(Boolean(data.available), `${data.message || ''}${nextDate}`);
        } catch (err) {
            setAvailability(false, 'Unable to check availability right now.');
        }
    };

    const renderCalendar = () => {
        if (!calendar) return;

        const days = [];
        for (let i = 0; i < 42; i += 1) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const value = toDateOnly(date);
            const range = config.bookingRanges.find((booking) => value >= booking.checkIn && value < booking.checkOut);
            days.push({ date, value, status: range ? range.status.toLowerCase() : 'available' });
        }

        calendar.replaceChildren(
            ...days.map((day) => {
                const item = document.createElement('div');
                item.className = `calendar-day ${day.status}`;
                item.innerHTML = `<span>${day.date.toLocaleDateString('en-IN', { weekday: 'short' })}</span><strong>${day.date.getDate()}</strong>`;
                item.title = `${day.value} - ${day.status}`;
                return item;
            })
        );
    };

    [checkInInput, checkOutInput, guestsInput].forEach((input) => {
        if (!input) return;
        input.addEventListener('input', () => {
            if (checkInInput?.value && checkOutInput) {
                const checkIn = parseDate(checkInInput.value);
                const minCheckOut = new Date(checkIn);
                minCheckOut.setDate(minCheckOut.getDate() + 1);
                checkOutInput.min = toDateOnly(minCheckOut);
            }

            updateTotals();
            checkAvailability();
        });
    });

    if (form) {
        form.addEventListener('submit', (event) => {
            if (bookNowBtn && bookNowBtn.disabled) {
                event.preventDefault();
                event.stopPropagation();
                setAvailability(false, alertBox?.textContent || 'Please select available dates.');
            }
        });
    }

    updateTotals();
    renderCalendar();
})();
